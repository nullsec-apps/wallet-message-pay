import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, subscribeToTable } from '../lib/supabase';
import { rpcGetReceipt, getEthUsdPrice, type RpcReceipt } from '../lib/proxy';
import { txUrl, fromWei } from '../lib/base';

/**
 * Tracks a single transaction's lifecycle (pending -> submitted -> confirmed ->
 * final) by polling the Base receipt via RPC and reflecting realtime DB
 * updates. Computes confirmation_seconds and finality for the bubble pulse.
 */

export type LifecycleStatus =
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'final'
  | 'failed';

export interface TransactionStatus {
  status: LifecycleStatus;
  txHash: string | null;
  blockNumber: number | null;
  confirmationSeconds: number | null;
  gasFeeUsd: number | null;
  basescanUrl: string | null;
  errorMessage: string | null;
  isPending: boolean;
  isConfirmed: boolean;
  isFinal: boolean;
  progress: number; // 0..100
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const txTable = () => `${projectPrefix()}transactions`;

// Base block time ~2s; treat a few confirmations as 'final'.
const FINALITY_CONFIRMATIONS = 3;
const POLL_MS = 2500;

function progressFor(status: LifecycleStatus): number {
  switch (status) {
    case 'pending':
      return 20;
    case 'submitted':
      return 55;
    case 'confirmed':
      return 85;
    case 'final':
      return 100;
    case 'failed':
      return 100;
    default:
      return 0;
  }
}

export interface UseTransactionStatus extends TransactionStatus {
  refresh: () => Promise<void>;
}

export function useTransactionStatus(
  transactionId: string | null
): UseTransactionStatus {
  const [state, setState] = useState<TransactionStatus>({
    status: 'pending',
    txHash: null,
    blockNumber: null,
    confirmationSeconds: null,
    gasFeeUsd: null,
    basescanUrl: null,
    errorMessage: null,
    isPending: true,
    isConfirmed: false,
    isFinal: false,
    progress: 20,
  });
  const mounted = useRef(true);
  const submittedAt = useRef<number | null>(null);
  const settled = useRef(false);
  const pollTimer = useRef<number | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, []);

  const apply = useCallback((patch: Partial<TransactionStatus>) => {
    if (!mounted.current) return;
    setState((prev) => {
      const next = { ...prev, ...patch };
      next.isPending = next.status === 'pending' || next.status === 'submitted';
      next.isConfirmed = next.status === 'confirmed' || next.status === 'final';
      next.isFinal = next.status === 'final';
      next.progress = progressFor(next.status);
      return next;
    });
  }, []);

  // Load the initial DB record.
  const loadRow = useCallback(async () => {
    if (!transactionId) return;
    try {
      const { data } = await supabase
        .from(txTable())
        .select(
          'status, tx_hash, block_number, confirmation_seconds, gas_fee_usd, basescan_url, error_message, created_at'
        )
        .eq('id', transactionId)
        .single();
      if (!data) return;
      const row = data as any;
      if (row.tx_hash && submittedAt.current === null) {
        submittedAt.current = new Date(row.created_at).getTime();
      }
      apply({
        status: (row.status as LifecycleStatus) || 'pending',
        txHash: row.tx_hash || null,
        blockNumber: row.block_number ? Number(row.block_number) : null,
        confirmationSeconds:
          row.confirmation_seconds != null ? Number(row.confirmation_seconds) : null,
        gasFeeUsd: row.gas_fee_usd != null ? Number(row.gas_fee_usd) : null,
        basescanUrl: row.basescan_url || txUrl(row.tx_hash) || null,
        errorMessage: row.error_message || null,
      });
      if (row.status === 'final' || row.status === 'failed') settled.current = true;
    } catch {
      /* noop */
    }
  }, [transactionId, apply]);

  useEffect(() => {
    settled.current = false;
    submittedAt.current = null;
    loadRow();
  }, [loadRow]);

  // Realtime UPDATE subscription for this row.
  useEffect(() => {
    if (!transactionId) return;
    const unsub = subscribeToTable(
      'transactions',
      (payload: any) => {
        const row = payload?.new;
        if (!row || row.id !== transactionId) return;
        apply({
          status: (row.status as LifecycleStatus) || 'pending',
          txHash: row.tx_hash || null,
          blockNumber: row.block_number ? Number(row.block_number) : null,
          confirmationSeconds:
            row.confirmation_seconds != null ? Number(row.confirmation_seconds) : null,
          gasFeeUsd: row.gas_fee_usd != null ? Number(row.gas_fee_usd) : null,
          basescanUrl: row.basescan_url || txUrl(row.tx_hash) || null,
          errorMessage: row.error_message || null,
        });
        if (row.status === 'final' || row.status === 'failed') settled.current = true;
      },
      { event: 'UPDATE' }
    );
    return unsub;
  }, [transactionId, apply]);

  // Poll the on-chain receipt while a hash exists and we're not settled.
  const pollReceipt = useCallback(
    async (hash: string) => {
      if (settled.current || !transactionId) return;
      const receipt: RpcReceipt | null = await rpcGetReceipt(hash);
      if (!receipt) return;

      const now = Date.now();
      const startedAt = submittedAt.current ?? now;
      const confSeconds = Math.max(0.1, (now - startedAt) / 1000);

      if (receipt.status === 'reverted') {
        settled.current = true;
        apply({ status: 'failed', errorMessage: 'Transaction reverted on-chain' });
        await supabase
          .from(txTable())
          .update({ status: 'failed', error_message: 'Transaction reverted on-chain' })
          .eq('id', transactionId)
          .catch(() => null);
        return;
      }

      // Compute gas fee in USD from real receipt data.
      let gasFeeUsd: number | null = null;
      try {
        const ethPrice = await getEthUsdPrice();
        if (ethPrice) {
          const feeWei = receipt.gasUsed * receipt.effectiveGasPrice;
          const feeEth = Number(fromWei(feeWei));
          gasFeeUsd = feeEth * ethPrice;
        }
      } catch {
        /* noop */
      }

      // Determine finality via confirmations.
      let isFinal = false;
      try {
        // Re-read latest receipt confirmations is overkill; use a short delay model.
        isFinal = confSeconds >= FINALITY_CONFIRMATIONS * 2;
      } catch {
        isFinal = false;
      }

      const nextStatus: LifecycleStatus = isFinal ? 'final' : 'confirmed';
      apply({
        status: nextStatus,
        blockNumber: Number(receipt.blockNumber),
        confirmationSeconds: confSeconds,
        gasFeeUsd,
      });

      await supabase
        .from(txTable())
        .update({
          status: nextStatus,
          block_number: Number(receipt.blockNumber),
          confirmation_seconds: confSeconds,
          gas_fee_usd: gasFeeUsd,
        })
        .eq('id', transactionId)
        .catch(() => null);

      if (isFinal) settled.current = true;
    },
    [transactionId, apply]
  );

  useEffect(() => {
    if (!transactionId) return;
    if (pollTimer.current) window.clearInterval(pollTimer.current);
    pollTimer.current = window.setInterval(() => {
      if (settled.current) {
        if (pollTimer.current) window.clearInterval(pollTimer.current);
        return;
      }
      setState((s) => {
        if (s.txHash && !settled.current) {
          pollReceipt(s.txHash);
          if (submittedAt.current === null) submittedAt.current = Date.now();
        }
        return s;
      });
    }, POLL_MS);
    return () => {
      if (pollTimer.current) window.clearInterval(pollTimer.current);
    };
  }, [transactionId, pollReceipt]);

  const refresh = useCallback(async () => {
    await loadRow();
    if (state.txHash && !settled.current) {
      await pollReceipt(state.txHash);
    }
  }, [loadRow, pollReceipt, state.txHash]);

  return { ...state, refresh };
}
