import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';
import { normalizeE164, getPhoneCountry } from '../lib/phone';
import type { CountryCode } from '../lib/phone';

/**
 * Subscribes to app_{projectId}_threads (realtime INSERT/UPDATE) for the
 * current user; creates threads on first send to a phone number. Each thread
 * is a phone-number contact in the chat-as-ledger model.
 */

export interface Thread {
  id: string;
  owner_user_id: string;
  counterparty_phone: string;
  counterparty_country_code: string | null;
  counterparty_wallet: string | null;
  last_message_at: string | null;
  created_at: string;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const threadsTable = () => `${projectPrefix()}threads`;

export interface UseThreads {
  threads: Thread[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getOrCreateThread: (
    rawPhone: string,
    counterpartyWallet?: string | null
  ) => Promise<Thread | null>;
  touchThread: (threadId: string) => Promise<void>;
}

export function useThreads(ownerUserId: string | null): UseThreads {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sortDesc = (a: Thread, b: Thread) => {
    const ta = new Date(a.last_message_at || a.created_at).getTime();
    const tb = new Date(b.last_message_at || b.created_at).getTime();
    return tb - ta;
  };

  const refresh = useCallback(async () => {
    if (!ownerUserId) {
      setThreads([]);
      seen.current = new Set();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from(threadsTable())
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (err) throw err;
      const rows = (data || []) as Thread[];
      seen.current = new Set(rows.map((r) => r.id));
      if (mounted.current) setThreads(rows.sort(sortDesc));
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Failed to load threads');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [ownerUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime INSERT/UPDATE subscription scoped to this owner.
  useEffect(() => {
    if (!ownerUserId) return;
    const unsubInsert = subscribeToTable(
      'threads',
      (payload: any) => {
        const row = payload?.new as Thread | undefined;
        if (!row || row.owner_user_id !== ownerUserId) return;
        if (seen.current.has(row.id)) {
          // treat as update
          if (mounted.current) {
            setThreads((prev) =>
              prev.map((t) => (t.id === row.id ? row : t)).sort(sortDesc)
            );
          }
          return;
        }
        seen.current.add(row.id);
        if (mounted.current) {
          setThreads((prev) => [row, ...prev].sort(sortDesc));
        }
      },
      { event: 'INSERT' }
    );
    const unsubUpdate = subscribeToTable(
      'threads',
      (payload: any) => {
        const row = payload?.new as Thread | undefined;
        if (!row || row.owner_user_id !== ownerUserId) return;
        seen.current.add(row.id);
        if (mounted.current) {
          setThreads((prev) => {
            const exists = prev.some((t) => t.id === row.id);
            const next = exists
              ? prev.map((t) => (t.id === row.id ? row : t))
              : [row, ...prev];
            return next.sort(sortDesc);
          });
        }
      },
      { event: 'UPDATE' }
    );
    return () => {
      unsubInsert();
      unsubUpdate();
    };
  }, [ownerUserId]);

  const getOrCreateThread = useCallback(
    async (
      rawPhone: string,
      counterpartyWallet?: string | null
    ): Promise<Thread | null> => {
      if (!ownerUserId) return null;
      const e164 = normalizeE164(rawPhone);
      if (!e164) {
        if (mounted.current) setError('Invalid recipient phone number');
        return null;
      }
      const iso = getPhoneCountry(e164) as CountryCode | null;

      try {
        // Existing thread for this owner + phone?
        const { data: existing } = await supabase
          .from(threadsTable())
          .select('*')
          .eq('owner_user_id', ownerUserId)
          .eq('counterparty_phone', e164)
          .limit(1);

        if (existing && existing.length > 0) {
          const t = existing[0] as Thread;
          // Backfill wallet if we just resolved one
          if (counterpartyWallet && !t.counterparty_wallet) {
            await supabase
              .from(threadsTable())
              .update({ counterparty_wallet: counterpartyWallet })
              .eq('id', t.id);
            t.counterparty_wallet = counterpartyWallet;
          }
          seen.current.add(t.id);
          if (mounted.current) {
            setThreads((prev) => {
              const exists = prev.some((p) => p.id === t.id);
              return (exists ? prev.map((p) => (p.id === t.id ? t : p)) : [t, ...prev]).sort(
                sortDesc
              );
            });
          }
          return t;
        }

        const { data: created, error: createErr } = await supabase
          .from(threadsTable())
          .insert({
            owner_user_id: ownerUserId,
            counterparty_phone: e164,
            counterparty_country_code: iso || null,
            counterparty_wallet: counterpartyWallet || null,
            last_message_at: new Date().toISOString(),
          })
          .select('*')
          .single();
        if (createErr) throw createErr;
        const t = created as Thread;
        seen.current.add(t.id);
        if (mounted.current) {
          setThreads((prev) => [t, ...prev].sort(sortDesc));
        }
        return t;
      } catch (e: any) {
        if (mounted.current) setError(e?.message || 'Failed to create thread');
        return null;
      }
    },
    [ownerUserId]
  );

  const touchThread = useCallback(async (threadId: string) => {
    if (!threadId) return;
    const now = new Date().toISOString();
    try {
      await supabase
        .from(threadsTable())
        .update({ last_message_at: now })
        .eq('id', threadId);
      if (mounted.current) {
        setThreads((prev) =>
          prev
            .map((t) => (t.id === threadId ? { ...t, last_message_at: now } : t))
            .sort(sortDesc)
        );
      }
    } catch {
      /* noop */
    }
  }, []);

  return { threads, loading, error, refresh, getOrCreateThread, touchThread };
}
