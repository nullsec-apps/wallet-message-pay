import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeE164, getPhoneCountry, isoToFlag, maskPhone } from '../lib/phone';
import type { CountryCode } from '../lib/phone';

/**
 * Resolves a phone number (E.164) to a wallet address via the wallet_mappings
 * table. Returns claimed/pending status and handles recipient onboarding for
 * unclaimed numbers. Never invents addresses — pending mappings hold funds
 * until the recipient claims.
 */

export type ResolveStatus = 'idle' | 'resolving' | 'resolved' | 'pending' | 'error';

export interface ResolvedRecipient {
  phone: string; // normalized E.164
  countryIso: CountryCode | null;
  flag: string;
  masked: string;
  walletAddress: string | null;
  isClaimed: boolean;
  status: ResolveStatus;
  mappingId: string | null;
  error?: string | null;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}

const usersTable = () => `${projectPrefix()}users`;
const mappingsTable = () => `${projectPrefix()}wallet_mappings`;

export interface UsePhoneResolver {
  recipient: ResolvedRecipient | null;
  status: ResolveStatus;
  resolve: (rawPhone: string, defaultCountry?: CountryCode) => Promise<ResolvedRecipient | null>;
  reset: () => void;
}

export function usePhoneResolver(): UsePhoneResolver {
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(null);
  const [status, setStatus] = useState<ResolveStatus>('idle');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    setRecipient(null);
    setStatus('idle');
  }, []);

  const resolve = useCallback(
    async (rawPhone: string, defaultCountry?: CountryCode): Promise<ResolvedRecipient | null> => {
      const e164 = normalizeE164(rawPhone, defaultCountry);
      if (!e164) {
        const errRec: ResolvedRecipient = {
          phone: rawPhone,
          countryIso: null,
          flag: '\uD83C\uDF10',
          masked: maskPhone(rawPhone),
          walletAddress: null,
          isClaimed: false,
          status: 'error',
          mappingId: null,
          error: 'Not a valid phone number',
        };
        if (mounted.current) {
          setRecipient(errRec);
          setStatus('error');
        }
        return errRec;
      }

      const iso = getPhoneCountry(e164);
      const base: Omit<ResolvedRecipient, 'walletAddress' | 'isClaimed' | 'status' | 'mappingId'> = {
        phone: e164,
        countryIso: iso,
        flag: isoToFlag(iso),
        masked: maskPhone(e164),
      };

      if (mounted.current) setStatus('resolving');

      try {
        // 1) Is there an onboarded user with this phone? -> claimed wallet.
        const { data: userRows, error: userErr } = await supabase
          .from(usersTable())
          .select('id, wallet_address, phone_number')
          .eq('phone_number', e164)
          .limit(1);

        if (!userErr && userRows && userRows.length > 0 && userRows[0].wallet_address) {
          const rec: ResolvedRecipient = {
            ...base,
            walletAddress: userRows[0].wallet_address as string,
            isClaimed: true,
            status: 'resolved',
            mappingId: null,
          };
          if (mounted.current) {
            setRecipient(rec);
            setStatus('resolved');
          }
          return rec;
        }

        // 2) Existing wallet mapping?
        const { data: mapRows } = await supabase
          .from(mappingsTable())
          .select('id, wallet_address, status, is_claimed')
          .eq('phone_number', e164)
          .order('created_at', { ascending: false })
          .limit(1);

        if (mapRows && mapRows.length > 0) {
          const m = mapRows[0] as {
            id: string;
            wallet_address: string | null;
            status: string;
            is_claimed: boolean;
          };
          const resolved = !!m.wallet_address && m.is_claimed;
          const rec: ResolvedRecipient = {
            ...base,
            walletAddress: m.wallet_address,
            isClaimed: m.is_claimed,
            status: resolved ? 'resolved' : 'pending',
            mappingId: m.id,
          };
          if (mounted.current) {
            setRecipient(rec);
            setStatus(resolved ? 'resolved' : 'pending');
          }
          return rec;
        }

        // 3) No mapping yet -> create a pending mapping (funds held / onboarding).
        const { data: created, error: createErr } = await supabase
          .from(mappingsTable())
          .insert({
            phone_number: e164,
            phone_country_code: iso || null,
            wallet_address: null,
            status: 'pending',
            is_claimed: false,
          })
          .select('id')
          .single();

        if (createErr) {
          const rec: ResolvedRecipient = {
            ...base,
            walletAddress: null,
            isClaimed: false,
            status: 'pending',
            mappingId: null,
            error: null,
          };
          if (mounted.current) {
            setRecipient(rec);
            setStatus('pending');
          }
          return rec;
        }

        const rec: ResolvedRecipient = {
          ...base,
          walletAddress: null,
          isClaimed: false,
          status: 'pending',
          mappingId: (created as { id: string }).id,
        };
        if (mounted.current) {
          setRecipient(rec);
          setStatus('pending');
        }
        return rec;
      } catch (err: any) {
        const rec: ResolvedRecipient = {
          ...base,
          walletAddress: null,
          isClaimed: false,
          status: 'error',
          mappingId: null,
          error: err?.message || 'Resolution failed',
        };
        if (mounted.current) {
          setRecipient(rec);
          setStatus('error');
        }
        return rec;
      }
    },
    []
  );

  return { recipient, status, resolve, reset };
}
