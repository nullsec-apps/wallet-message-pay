import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { usePhoneResolver, type ResolvedRecipient } from './usePhoneResolver';
import {
  USDC_ADDRESS,
  USDC_SYMBOL,
  toUsdcUnits,
  ERC20_ABI,
  txUrl,
} from '../lib/base';
import { twilioSend } from '../lib/proxy';
import { encodeFunctionData } from 'viem';
import { formatUsdc } from '../lib/format';

/**
 * Orchestrates a send:
 *   resolve recipient -> confirm -> sign USDC transfer with the Privy embedded
 *   wallet on Base -> persist transaction -> write a payment message bubble ->
 *   trigger a Twilio confirmation.
 *
 * Signing is delegated to the Privy embedded wallet provider (window.__PRIVY__
 * or an injected EIP-1193 provider). Private keys are NEVER reconstructed here.
 */

export type SendStage =
  | 'idle'
  | 'resolving'
  | 'awaiting-confirm'
  | 'signing'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'recipient-pending';

export interface SendDraft {
  rawPhone: string;
  amount: string;
  token: string;
}

export interface SendResult {
  transactionId: string | null;
  txHash: string | null;
  status: SendStage;
  error: string | null;
}

function projectPrefix(): string {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return `app_${ns.projectId || 'app'}_`;
}
const txTable = () => `${projectPrefix()}transactions`;
const messagesTable = () => `${projectPrefix()}messages`;

interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
}

/** Best-effort lookup of a Privy embedded-wallet EIP-1193 provider. */
async function getSigner(): Promise<{ provider: Eip1193Provider; from: string } | null> {
  if (typeof window === 'undefined') return null;
  const sdk = (window as any).__PRIVY__;
  // Privy embedded wallet exposes getEthereumProvider() on the wallet object
  try {
    if (sdk?.wallets?.[0]?.getEthereumProvider) {
      const provider = await sdk.wallets[0].getEthereumProvider();
      const from =
        sdk.wallets[0].address ||
        sdk.user?.wallet?.address ||
        (await provider.request({ method: 'eth_accounts' }))?.[0];
      if (provider && from) return { provider, from };
    }
    if (sdk?.getEthereumProvider) {
      const provider = await sdk.getEthereumProvider();
      const accounts = await provider.request({ method: 'eth_accounts' });
      if (provider && accounts?.[0]) return { provider, from: accounts[0] };
    }
  } catch {
    /* fall through */
  }
  const injected = (window as any).ethereum as Eip1193Provider | undefined;
  if (injected?.request) {
    try {
      const accounts = await injected.request({ method: 'eth_accounts' });
      if (accounts?.[0]) return { provider: injected, from: accounts[0] };
    } catch {
      /* noop */
    }
  }
  return null;
}

export interface UseSendPayment {
  stage: SendStage;
  draft: SendDraft;
  recipient: ResolvedRecipient | null;
  error: string | null;
  result: SendResult | null;
  setDraft: (patch: Partial<SendDraft>) => void;
  prepare: (rawPhone: string, amount: string) => Promise<ResolvedRecipient | null>;
  confirmAndSend: (params: {
    senderUserId: string;
    senderWallet: string;
    threadId?: string | null;
    initiatedVia?: 'app' | 'sms' | 'whatsapp';
  }) => Promise<SendResult>;
  reset: () => void;
}

export function useSendPayment(): UseSendPayment {
  const [stage, setStage] = useState<SendStage>('idle');
  const [draft, setDraftState] = useState<SendDraft>({
    rawPhone: '',
    amount: '',
    token: USDC_SYMBOL,
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);
  const { recipient, resolve } = usePhoneResolver();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setDraft = useCallback((patch: Partial<SendDraft>) => {
    setDraftState((d) => ({ ...d, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setError(null);
    setResult(null);
    setDraftState({ rawPhone: '', amount: '', token: USDC_SYMBOL });
  }, []);

  const prepare = useCallback(
    async (rawPhone: string, amount: string): Promise<ResolvedRecipient | null> => {
      setError(null);
      setResult(null);
      setDraftState((d) => ({ ...d, rawPhone, amount }));
      const amt = Number(String(amount).replace(',', '.'));
      if (!amt || amt <= 0) {
        setError('Enter an amount greater than 0');
        setStage('idle');
        return null;
      }
      if (mounted.current) setStage('resolving');
      const rec = await resolve(rawPhone);
      if (!rec || rec.status === 'error') {
        if (mounted.current) {
          setError(rec?.error || 'Could not resolve recipient');
          setStage('failed');
        }
        return rec;
      }
      if (mounted.current) {
        setStage(rec.isClaimed && rec.walletAddress ? 'awaiting-confirm' : 'recipient-pending');
      }
      return rec;
    },
    [resolve]
  );

  const confirmAndSend = useCallback(
    async (params: {
      senderUserId: string;
      senderWallet: string;
      threadId?: string | null;
      initiatedVia?: 'app' | 'sms' | 'whatsapp';
    }): Promise<SendResult> => {
      const fail = (msg: string, txId: string | null = null): SendResult => {
        const r: SendResult = {
          transactionId: txId,
          txHash: null,
          status: 'failed',
          error: msg,
        };
        if (mounted.current) {
          setError(msg);
          setStage('failed');
          setResult(r);
        }
        return r;
      };

      const rec = recipient;
      if (!rec) return fail('No recipient resolved');
      const amountNum = Number(String(draft.amount).replace(',', '.'));
      if (!amountNum || amountNum <= 0) return fail('Invalid amount');

      // Persist a pending transaction record up front (real DB row).
      let txRowId: string | null = null;
      try {
        const { data: inserted, error: insErr } = await supabase
          .from(txTable())
          .insert({
            sender_user_id: params.senderUserId,
            sender_wallet: params.senderWallet,
            recipient_phone: rec.phone,
            recipient_wallet: rec.walletAddress,
            thread_id: params.threadId || null,
            amount: amountNum,
            token_symbol: USDC_SYMBOL,
            token_address: USDC_ADDRESS,
            chain: 'base',
            status: 'pending',
            initiated_via: params.initiatedVia || 'app',
            raw: {},
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        txRowId = (inserted as { id: string }).id;
      } catch (e: any) {
        return fail(e?.message || 'Could not record transaction');
      }

      // Recipient not yet claimed -> funds held against pending mapping.
      if (!rec.walletAddress || !rec.isClaimed) {
        try {
          await supabase
            .from(txTable())
            .update({
              status: 'pending',
              error_message: null,
              raw: { note: 'recipient_unclaimed_funds_held' },
            })
            .eq('id', txRowId);
          // Notify recipient with a claim prompt (best-effort).
          await twilioSend({
            to: rec.phone,
            channel: params.initiatedVia === 'whatsapp' ? 'whatsapp' : 'sms',
            body: `You have ${formatUsdc(amountNum)} ${USDC_SYMBOL} waiting on Base. Reply to claim and set up your free wallet.`,
          }).catch(() => null);
        } catch {
          /* noop */
        }
        const r: SendResult = {
          transactionId: txRowId,
          txHash: null,
          status: 'recipient-pending',
          error: null,
        };
        if (mounted.current) {
          setStage('recipient-pending');
          setResult(r);
        }
        return r;
      }

      // Sign + submit the USDC transfer via the embedded wallet.
      if (mounted.current) setStage('signing');
      const signer = await getSigner();
      if (!signer) {
        return fail('Wallet signer unavailable — reconnect your wallet', txRowId);
      }

      try {
        const data = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [rec.walletAddress as `0x${string}`, toUsdcUnits(amountNum)],
        });
        const txHash: string = await signer.provider.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: signer.from,
              to: USDC_ADDRESS,
              data,
              value: '0x0',
            },
          ],
        });

        if (!txHash || typeof txHash !== 'string') {
          return fail('No transaction hash returned', txRowId);
        }

        // Persist the submitted hash.
        await supabase
          .from(txTable())
          .update({
            status: 'submitted',
            tx_hash: txHash,
            basescan_url: txUrl(txHash),
          })
          .eq('id', txRowId);

        // Write the payment bubble into the thread.
        if (params.threadId) {
          await supabase
            .from(messagesTable())
            .insert({
              thread_id: params.threadId,
              owner_user_id: params.senderUserId,
              direction: 'outbound',
              channel: params.initiatedVia || 'app',
              body: `Sent ${formatUsdc(amountNum)} ${USDC_SYMBOL}`,
              message_type: 'payment',
              transaction_id: txRowId,
              raw: { tx_hash: txHash },
            })
            .then(() => {
              return supabase
                .from(`${projectPrefix()}threads`)
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', params.threadId);
            });
        }

        // Fire a confirmation message to the recipient (best-effort).
        twilioSend({
          to: rec.phone,
          channel: params.initiatedVia === 'whatsapp' ? 'whatsapp' : 'sms',
          body: `You received ${formatUsdc(amountNum)} ${USDC_SYMBOL} on Base. View: ${txUrl(txHash)}`,
        }).catch(() => null);

        const r: SendResult = {
          transactionId: txRowId,
          txHash,
          status: 'submitted',
          error: null,
        };
        if (mounted.current) {
          setStage('submitted');
          setResult(r);
        }
        return r;
      } catch (e: any) {
        const msg =
          e?.code === 4001 || /reject/i.test(e?.message || '')
            ? 'Transaction rejected'
            : e?.message || 'Transaction failed';
        await supabase
          .from(txTable())
          .update({ status: 'failed', error_message: msg })
          .eq('id', txRowId)
          .catch(() => null);
        return fail(msg, txRowId);
      }
    },
    [recipient, draft.amount]
  );

  return {
    stage,
    draft,
    recipient,
    error,
    result,
    setDraft,
    prepare,
    confirmAndSend,
    reset,
  };
}
