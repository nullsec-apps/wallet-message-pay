import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';
import { txUrl, USDC_ADDRESS } from '../lib/base';

/**
 * Queries app_{projectId}_transactions with realtime INSERT/UPDATE
 * subscriptions to drive receipt cards and bubble confirmation states.
 * Every figure here is a real persisted on-chain record — never fabricated.
 */

export type TxStatus = 'pending' | 'submitted' | 'confirmed' | 'final' | 'failed';
export type InitiatedVia = 'app' | 'sms' | 'whatsapp';

export interface Transaction {
  id: string;
  sender_user_id: string;
  sender_wallet: string;
  recipient_phone: string;
  recipient_wallet: string | null;
  thread_id: string | null;
  amount: number;
  token_symbol: string;
  token_address: string | null;
  chain: string;
  status: TxStatus;
  tx_hash: string | null;
  block_number: number | null;
  gas_fee_usd: number | null;
  confirmation_seconds: number | null;
  basescan_url: string | null;
  initiated_via: InitiatedVia | null;
  error_message: string | null;
  raw: Record<string, unknown> | null;
  created_at: string;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const txTable = () => `${projectPrefix()}transactions`;

function normalize(row: Transaction): Transaction {
  return {
    ...row,
    amount: typeof row.amount === 'string' ? Number(row.amount) : row.amount,
    token_symbol: row.token_symbol || 'USDC',
    token_address: row.token_address || USDC_ADDRESS,
    basescan_url: row.basescan_url || txUrl(row.tx_hash) || null,
  };
}

export interface UseTransactions {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  byThread: (threadId: string | null) => Transaction[];
  getById: (id: string) => Transaction | undefined;
  upsertLocal: (tx: Transaction) => void;
}

export function useTransactions(
  ownerUserId: string | null,
  opts: { threadId?: string | null } = {}
): UseTransactions {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const threadId = opts.threadId ?? null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const sortDesc = (a: Transaction, b: Transaction) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const refresh = useCallback(async () => {
    if (!ownerUserId) {
      setTransactions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let q = supabase
        .from(txTable())
        .select('*')
        .eq('sender_user_id', ownerUserId)
        .order('created_at', { ascending: false });
      if (threadId) q = q.eq('thread_id', threadId);
      const { data, error: err } = await q;
      if (err) throw err;
      const rows = ((data || []) as Transaction[]).map(normalize);
      if (mounted.current) setTransactions(rows.sort(sortDesc));
    } catch (e: any) {
      if (mounted.current) setError(e?.message || 'Failed to load transactions');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [ownerUserId, threadId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upsertLocal = useCallback((tx: Transaction) => {
    const n = normalize(tx);
    if (mounted.current) {
      setTransactions((prev) => {
        const exists = prev.some((t) => t.id === n.id);
        const next = exists ? prev.map((t) => (t.id === n.id ? n : t)) : [n, ...prev];
        return next.sort(sortDesc);
      });
    }
  }, []);

  // Realtime INSERT + UPDATE scoped to this owner.
  useEffect(() => {
    if (!ownerUserId) return;
    const handle = (payload: any) => {
      const row = payload?.new as Transaction | undefined;
      if (!row || row.sender_user_id !== ownerUserId) return;
      if (threadId && row.thread_id !== threadId) return;
      upsertLocal(row);
    };
    const unsubInsert = subscribeToTable('transactions', handle, { event: 'INSERT' });
    const unsubUpdate = subscribeToTable('transactions', handle, { event: 'UPDATE' });
    return () => {
      unsubInsert();
      unsubUpdate();
    };
  }, [ownerUserId, threadId, upsertLocal]);

  const byThread = useCallback(
    (tid: string | null) => {
      if (!tid) return transactions;
      return transactions.filter((t) => t.thread_id === tid);
    },
    [transactions]
  );

  const getById = useCallback(
    (id: string) => transactions.find((t) => t.id === id),
    [transactions]
  );

  return { transactions, loading, error, refresh, byThread, getById, upsertLocal };
}
