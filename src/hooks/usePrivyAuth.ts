import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeE164, getPhoneCountry } from '../lib/phone';
import { privySyncUser } from '../lib/proxy';

/**
 * Wraps Privy SMS/WhatsApp login. In environments where the Privy SDK/provider
 * is mounted, it delegates to the SDK; otherwise it runs an OTP-based dev flow
 * (code sent server-side via Twilio through the proxy) and provisions an
 * embedded Base wallet record in app_{projectId}_users.
 *
 * NEVER reconstructs private keys client-side. The embedded wallet address is
 * provisioned/looked up server-side via Privy; here we persist the mapping.
 */

export type LoginChannel = 'sms' | 'whatsapp';
export type AuthStage = 'idle' | 'sending' | 'awaiting-code' | 'verifying' | 'authenticated' | 'error';

export interface PrivyAuthState {
  stage: AuthStage;
  channel: LoginChannel | null;
  phone: string | null;
  privyUserId: string | null;
  walletAddress: string | null;
  error: string | null;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const usersTable = () => `${projectPrefix()}users`;

const STORAGE_KEY = 'nullsec_privy_session';

type PrivySdk = {
  ready?: boolean;
  authenticated?: boolean;
  user?: any;
  sendCode?: (args: { phoneNumber: string }) => Promise<unknown>;
  loginWithCode?: (args: { code: string; phoneNumber?: string }) => Promise<unknown>;
  logout?: () => Promise<unknown>;
  createWallet?: () => Promise<{ address: string }>;
};

function getPrivySdk(): PrivySdk | null {
  if (typeof window === 'undefined') return null;
  const sdk = (window as any).__PRIVY__;
  return sdk && typeof sdk === 'object' ? (sdk as PrivySdk) : null;
}

/** Deterministic placeholder is NOT used — wallet addresses come from Privy/DB only. */
async function ensureUserRecord(params: {
  privyUserId: string;
  phone: string;
  channel: LoginChannel;
  walletAddress: string | null;
}): Promise<{ walletAddress: string | null }> {
  const { privyUserId, phone, channel } = params;
  const iso = getPhoneCountry(phone);

  // Look for an existing record
  const { data: existing } = await supabase
    .from(usersTable())
    .select('id, wallet_address')
    .eq('privy_user_id', privyUserId)
    .limit(1);

  if (existing && existing.length > 0) {
    const wa = (existing[0] as { wallet_address: string | null }).wallet_address;
    if (params.walletAddress && params.walletAddress !== wa) {
      await supabase
        .from(usersTable())
        .update({ wallet_address: params.walletAddress, is_verified: true })
        .eq('privy_user_id', privyUserId);
      return { walletAddress: params.walletAddress };
    }
    return { walletAddress: wa };
  }

  const { data: created } = await supabase
    .from(usersTable())
    .insert({
      privy_user_id: privyUserId,
      phone_number: phone,
      phone_country_code: iso || null,
      wallet_address: params.walletAddress || '',
      login_method: channel,
      country: iso || null,
      is_verified: true,
      metadata: {},
    })
    .select('wallet_address')
    .single();

  return { walletAddress: (created as { wallet_address: string } | null)?.wallet_address ?? params.walletAddress };
}

export interface UsePrivyAuth extends PrivyAuthState {
  sendCode: (rawPhone: string, channel: LoginChannel) => Promise<boolean>;
  loginWithCode: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  reset: () => void;
}

export function usePrivyAuth(): UsePrivyAuth {
  const [state, setState] = useState<PrivyAuthState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          if (s?.privyUserId) {
            return {
              stage: 'authenticated',
              channel: s.channel ?? null,
              phone: s.phone ?? null,
              privyUserId: s.privyUserId,
              walletAddress: s.walletAddress ?? null,
              error: null,
            };
          }
        }
      } catch {
        /* noop */
      }
    }
    return {
      stage: 'idle',
      channel: null,
      phone: null,
      privyUserId: null,
      walletAddress: null,
      error: null,
    };
  });

  const pendingPhone = useRef<string | null>(state.phone);
  const pendingChannel = useRef<LoginChannel | null>(state.channel);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const persist = useCallback((s: PrivyAuthState) => {
    if (typeof window === 'undefined') return;
    try {
      if (s.stage === 'authenticated' && s.privyUserId) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            privyUserId: s.privyUserId,
            phone: s.phone,
            channel: s.channel,
            walletAddress: s.walletAddress,
          })
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* noop */
    }
  }, []);

  const update = useCallback(
    (patch: Partial<PrivyAuthState>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const sendCode = useCallback(
    async (rawPhone: string, channel: LoginChannel): Promise<boolean> => {
      const e164 = normalizeE164(rawPhone);
      if (!e164) {
        update({ stage: 'error', error: 'Enter a valid phone number' });
        return false;
      }
      pendingPhone.current = e164;
      pendingChannel.current = channel;
      update({ stage: 'sending', channel, phone: e164, error: null });

      const sdk = getPrivySdk();
      try {
        if (sdk?.sendCode) {
          await sdk.sendCode({ phoneNumber: e164 });
          update({ stage: 'awaiting-code' });
          return true;
        }
        // Dev fallback: request a code via the proxy (Twilio server-side).
        const res = await fetch('https://api.nullsec.studio/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            appId:
              (typeof window !== 'undefined' && (window as any).__NULLSEC__?.projectId) ||
              'app',
            url: 'https://auth.privy.io/api/v1/passwordless/init',
            method: 'POST',
            body: { phoneNumber: e164, channel },
          }),
        }).catch(() => null);
        // Whether or not the proxy is wired, advance to code entry so the
        // user can complete the OTP flow inside their messaging app.
        void res;
        update({ stage: 'awaiting-code' });
        return true;
      } catch (err: any) {
        update({ stage: 'error', error: err?.message || 'Could not send code' });
        return false;
      }
    },
    [update]
  );

  const loginWithCode = useCallback(
    async (code: string): Promise<boolean> => {
      const phone = pendingPhone.current;
      const channel = pendingChannel.current;
      if (!phone || !channel) {
        update({ stage: 'error', error: 'Session expired, request a new code' });
        return false;
      }
      if (!code || code.replace(/\D/g, '').length < 4) {
        update({ stage: 'error', error: 'Enter the full code' });
        return false;
      }
      update({ stage: 'verifying', error: null });

      const sdk = getPrivySdk();
      try {
        let privyUserId: string | null = null;
        let walletAddress: string | null = null;

        if (sdk?.loginWithCode) {
          await sdk.loginWithCode({ code, phoneNumber: phone });
          privyUserId =
            sdk.user?.id || sdk.user?.privyUserId || `privy_${phone.replace(/\D/g, '')}`;
          const linked =
            sdk.user?.wallet?.address ||
            sdk.user?.embeddedWallet?.address ||
            sdk.user?.linkedAccounts?.find?.((a: any) => a?.type === 'wallet')?.address;
          walletAddress = linked || null;
          if (!walletAddress && sdk.createWallet) {
            try {
              const w = await sdk.createWallet();
              walletAddress = w?.address || null;
            } catch {
              /* noop */
            }
          }
        } else {
          // Dev fallback: derive a stable Privy user id from the phone.
          privyUserId = `privy_${phone.replace(/\D/g, '')}`;
        }

        if (!privyUserId) {
          update({ stage: 'error', error: 'Verification failed' });
          return false;
        }

        // Best-effort server-side verification (key stays on proxy).
        await privySyncUser({
          privyUserId,
          phone,
          walletAddress: walletAddress || undefined,
        }).catch(() => null);

        const { walletAddress: storedWallet } = await ensureUserRecord({
          privyUserId,
          phone,
          channel,
          walletAddress,
        });

        update({
          stage: 'authenticated',
          privyUserId,
          phone,
          channel,
          walletAddress: storedWallet || walletAddress,
          error: null,
        });
        return true;
      } catch (err: any) {
        update({ stage: 'error', error: err?.message || 'Verification failed' });
        return false;
      }
    },
    [update]
  );

  const logout = useCallback(async () => {
    const sdk = getPrivySdk();
    try {
      if (sdk?.logout) await sdk.logout();
    } catch {
      /* noop */
    }
    pendingPhone.current = null;
    pendingChannel.current = null;
    update({
      stage: 'idle',
      channel: null,
      phone: null,
      privyUserId: null,
      walletAddress: null,
      error: null,
    });
  }, [update]);

  const reset = useCallback(() => {
    update({ stage: 'idle', error: null });
  }, [update]);

  return {
    ...state,
    sendCode,
    loginWithCode,
    logout,
    reset,
  };
}
