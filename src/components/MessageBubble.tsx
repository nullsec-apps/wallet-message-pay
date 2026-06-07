import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatUsdc, truncateHash, clockTime, confirmationLabel, formatUsd, formatBlock } from '../lib/format';
import { truncateAddress } from '../lib/format';
import type { ThreadMessage } from '../hooks/useThreadMessages';
import type { Transaction } from '../hooks/useTransactions';
import { useTransactionStatus } from '../hooks/useTransactionStatus';

/**
 * A single chat-as-ledger bubble. Payment bubbles attach a live on-chain
 * receipt; the confirmation animates as an accent-blue pulse travelling the
 * bubble, settling to accent2 green on finality with a haptic tick.
 */

export interface MessageBubbleProps {
  message: ThreadMessage;
  transaction?: Transaction | null;
}

function haptic() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(12);
    }
  } catch {
    /* noop */
  }
}

export function MessageBubble({ message, transaction }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const isPayment = message.message_type === 'payment' || !!transaction;
  const isSystem = message.message_type === 'system';

  const status = useTransactionStatus(isPayment && transaction ? transaction.id : null);
  const [copied, setCopied] = useState(false);
  const wasFinal = useRef(false);

  useEffect(() => {
    if (status.isFinal && !wasFinal.current) {
      wasFinal.current = true;
      haptic();
    }
  }, [status.isFinal]);

  const copyHash = async () => {
    const h = transaction?.tx_hash || status.txHash;
    if (!h) return;
    try {
      await navigator.clipboard.writeText(h);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  // ---- System message ----
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-center my-2"
      >
        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-[#7E8896]">
          {message.body}
        </span>
      </motion.div>
    );
  }

  // ---- Plain text message ----
  if (!isPayment) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}
      >
        <div
          className={cn(
            'max-w-[78%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed transition-all duration-200',
            isOutbound
              ? 'bg-[#1E2530] text-[#F2F5F8] rounded-br-md'
              : 'bg-[#171B22] border border-white/6 text-[#F2F5F8] rounded-bl-md'
          )}
        >
          <p className="break-words whitespace-pre-wrap">{message.body}</p>
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-[#7E8896]">
            {message.channel !== 'app' && (
              <span className="uppercase tracking-wide">{message.channel}</span>
            )}
            <span>{clockTime(message.created_at)}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // ---- Payment bubble ----
  const amount = transaction ? transaction.amount : 0;
  const token = transaction?.token_symbol || 'USDC';
  const failed = status.status === 'failed' || transaction?.status === 'failed';
  const pending = status.isPending && !failed;
  const confirmed = status.isConfirmed && !failed;
  const final = status.isFinal && !failed;
  const basescan = transaction?.basescan_url || status.basescanUrl;
  const hash = transaction?.tx_hash || status.txHash;

  const accent = failed ? '#ef4444' : final ? '#3EE6A8' : '#0052FF';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}
    >
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              'group relative max-w-[88%] sm:max-w-[78%] overflow-hidden rounded-2xl border bg-[#171B22] text-left transition-all duration-200 hover:border-white/15 focus:outline-none focus:ring-2 focus:ring-[#0052FF]/40',
              isOutbound ? 'rounded-br-md' : 'rounded-bl-md',
              failed ? 'border-red-500/30' : final ? 'border-[#3EE6A8]/30' : 'border-[#0052FF]/30'
            )}
          >
            {/* travelling pulse along the top edge while pending */}
            {pending && (
              <motion.span
                className="absolute left-0 top-0 h-[2px] w-1/3 rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, #0052FF, transparent)' }}
                animate={{ x: ['-40%', '340%'] }}
                transition={{ duration: 1.4, ease: 'easeInOut', repeat: Infinity }}
              />
            )}
            {(confirmed || final) && !failed && (
              <motion.span
                className="absolute inset-x-0 top-0 h-[2px]"
                style={{ background: accent }}
                initial={{ scaleX: 0, transformOrigin: 'left' }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            )}

            <div className="px-4 pt-3.5 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ background: `${accent}22` }}
                >
                  <ArrowUpRight size={15} strokeWidth={2} style={{ color: accent }} />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-[#7E8896]">
                  {isOutbound ? 'Sent' : 'Received'} \u00B7 Base
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold text-[#F2F5F8]">
                  {formatUsdc(amount)}
                </span>
                <span className="text-sm font-medium text-[#7E8896]">{token}</span>
              </div>

              <div className="mt-2.5">
                <StatusChip failed={failed} pending={pending} final={final} confirmed={confirmed} status={status} />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/6 px-4 py-2">
              <span className="text-[10px] text-[#7E8896] font-mono">
                {hash ? truncateHash(hash) : 'awaiting hash'}
              </span>
              <span className="text-[10px] text-[#7E8896]">{clockTime(message.created_at)}</span>
            </div>
          </button>
        </HoverCardTrigger>

        <HoverCardContent
          align={isOutbound ? 'end' : 'start'}
          className="w-72 border-white/10 bg-[#171B22] text-[#F2F5F8]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#7E8896] mb-3">
            On-chain receipt
          </p>
          <div className="space-y-2.5 text-xs">
            <ReceiptRow label="Amount">
              <span className="font-medium">{formatUsdc(amount)} {token}</span>
            </ReceiptRow>
            {transaction?.recipient_wallet && (
              <ReceiptRow label="To">
                <span className="font-mono">{truncateAddress(transaction.recipient_wallet)}</span>
              </ReceiptRow>
            )}
            <Separator className="bg-white/6" />
            <ReceiptRow label="Tx hash">
              {hash ? (
                <button
                  onClick={copyHash}
                  className="flex items-center gap-1 font-mono text-[#3EE6A8] hover:opacity-80 transition-opacity duration-200"
                >
                  {truncateHash(hash)}
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              ) : (
                <span className="text-[#7E8896]">pending\u2026</span>
              )}
            </ReceiptRow>
            <ReceiptRow label="Block">
              <span className="font-mono">{formatBlock(status.blockNumber ?? transaction?.block_number)}</span>
            </ReceiptRow>
            <ReceiptRow label="Finality">
              <span>{confirmationLabel(status.confirmationSeconds ?? transaction?.confirmation_seconds)}</span>
            </ReceiptRow>
            <ReceiptRow label="Gas fee">
              <span>
                {status.gasFeeUsd != null || transaction?.gas_fee_usd != null
                  ? formatUsd(status.gasFeeUsd ?? transaction?.gas_fee_usd ?? 0)
                  : '\u2014'}
              </span>
            </ReceiptRow>
          </div>
          {basescan && (
            <a
              href={basescan}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-xs font-medium text-[#F2F5F8] hover:border-[#0052FF]/50 hover:bg-[#0052FF]/10 transition-all duration-200"
            >
              View on BaseScan <ExternalLink size={12} />
            </a>
          )}
        </HoverCardContent>
      </HoverCard>
    </motion.div>
  );
}

function StatusChip({
  failed,
  pending,
  final,
  confirmed,
  status,
}: {
  failed: boolean;
  pending: boolean;
  final: boolean;
  confirmed: boolean;
  status: ReturnType<typeof useTransactionStatus>;
}) {
  if (failed) {
    return (
      <Badge className="gap-1 border-0 bg-red-500/15 text-red-300">
        <XCircle size={12} /> Failed
      </Badge>
    );
  }
  if (final) {
    return (
      <Badge className="gap-1 border-0 bg-[#3EE6A8]/15 text-[#3EE6A8]">
        <CheckCircle2 size={12} /> Confirmed \u00B7 {confirmationLabel(status.confirmationSeconds)}
      </Badge>
    );
  }
  if (confirmed) {
    return (
      <Badge className="gap-1 border-0 bg-[#0052FF]/15 text-[#5b8bff]">
        <CheckCircle2 size={12} /> Confirmed on Base
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 border-0 bg-[#0052FF]/12 text-[#5b8bff]">
      {pending ? <Loader2 size={12} className="animate-spin" /> : <Clock size={12} />}
      Confirming on Base\u2026
    </Badge>
  );
}

function ReceiptRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#7E8896]">{label}</span>
      {children}
    </div>
  );
}

export default MessageBubble;
