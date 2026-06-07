import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Fuel,
  Hash,
  Layers,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  formatUsdc,
  truncateHash,
  truncateAddress,
  formatBlock,
  formatUsd,
  confirmationLabel,
  fullTimestamp,
} from '../lib/format';
import { flagMasked } from '../lib/phone';
import type { Transaction } from '../hooks/useTransactions';
import { useTransactionStatus } from '../hooks/useTransactionStatus';

export interface TransactionReceiptCardProps {
  transaction: Transaction | null;
  className?: string;
}

const STEPS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'final', label: 'Final' },
];

function stepIndex(status: string): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'submitted':
      return 1;
    case 'confirmed':
      return 2;
    case 'final':
      return 3;
    case 'failed':
      return 2;
    default:
      return 0;
  }
}

export function TransactionReceiptCard({
  transaction,
  className = '',
}: TransactionReceiptCardProps) {
  const status = useTransactionStatus(transaction ? transaction.id : null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* noop */
    }
  };

  if (!transaction) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={cn('flex h-full flex-col items-center justify-center px-6 text-center', className)}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
          <Receipt size={22} strokeWidth={1.5} className="text-[#7E8896]" />
        </div>
        <p className="mt-4 text-sm font-medium text-[#F2F5F8]">No receipt selected</p>
        <p className="mt-1.5 max-w-[220px] text-xs leading-relaxed text-[#7E8896]">
          Tap a payment bubble to view its full on-chain receipt, BaseScan link and finality.
        </p>
      </motion.div>
    );
  }

  const failed = status.status === 'failed' || transaction.status === 'failed';
  const final = status.isFinal && !failed;
  const idx = stepIndex(status.status);
  const hash = transaction.tx_hash || status.txHash;
  const basescan = transaction.basescan_url || status.basescanUrl;
  const accent = failed ? '#ef4444' : final ? '#3EE6A8' : '#0052FF';

  return (
    <motion.div
      key={transaction.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className={cn('flex h-full flex-col', className)}
    >
      <div className="px-1 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7E8896]">
          On-chain receipt
        </p>
      </div>

      <Card className="border-white/8 bg-[#171B22] p-4">
        {/* Amount header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-bold text-[#F2F5F8]">
                {formatUsdc(transaction.amount)}
              </span>
              <span className="text-sm font-medium text-[#7E8896]">
                {transaction.token_symbol}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#7E8896]">
              {flagMasked(transaction.recipient_phone)}
            </p>
          </div>
          <StatusBadge failed={failed} final={final} status={status.status} />
        </div>

        <Separator className="my-4 bg-white/6" />

        {/* Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-medium text-[#7E8896]">
            {STEPS.map((s, i) => (
              <span
                key={s.key}
                className={cn(
                  'transition-colors duration-200',
                  i <= idx && !failed ? 'text-[#F2F5F8]' : '',
                  failed && i === 2 ? 'text-red-300' : ''
                )}
              >
                {failed && i === 2 ? 'Failed' : s.label}
              </span>
            ))}
          </div>
          <div className="relative">
            <Progress value={status.progress} className="h-1.5 bg-white/6" />
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: accent }}
              initial={{ width: 0 }}
              animate={{ width: `${status.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        <Separator className="my-4 bg-white/6" />

        {/* Detail rows */}
        <div className="space-y-3 text-xs">
          <DetailRow icon={Hash} label="Tx hash">
            {hash ? (
              <button
                onClick={() => copy(hash, 'hash')}
                className="flex items-center gap-1.5 font-mono text-[#3EE6A8] transition-opacity duration-200 hover:opacity-80"
              >
                {truncateHash(hash)}
                {copied === 'hash' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-[#7E8896]">
                <Loader2 size={12} className="animate-spin" /> awaiting hash
              </span>
            )}
          </DetailRow>

          {transaction.recipient_wallet && (
            <DetailRow icon={Receipt} label="Recipient">
              <button
                onClick={() => copy(transaction.recipient_wallet!, 'addr')}
                className="flex items-center gap-1.5 font-mono text-[#F2F5F8] transition-opacity duration-200 hover:opacity-80"
              >
                {truncateAddress(transaction.recipient_wallet)}
                {copied === 'addr' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </DetailRow>
          )}

          <DetailRow icon={Layers} label="Block">
            <span className="font-mono text-[#F2F5F8]">
              {formatBlock(status.blockNumber ?? transaction.block_number)}
            </span>
          </DetailRow>

          <DetailRow icon={Zap} label="Finality">
            <span className="text-[#F2F5F8]">
              {confirmationLabel(
                status.confirmationSeconds ?? transaction.confirmation_seconds
              )}
            </span>
          </DetailRow>

          <DetailRow icon={Fuel} label="Gas fee">
            <span className="text-[#F2F5F8]">
              {status.gasFeeUsd != null || transaction.gas_fee_usd != null
                ? formatUsd(status.gasFeeUsd ?? transaction.gas_fee_usd ?? 0)
                : '\u2014'}
            </span>
          </DetailRow>

          <DetailRow icon={Clock} label="Created">
            <span className="text-[#7E8896]">{fullTimestamp(transaction.created_at)}</span>
          </DetailRow>
        </div>

        <AnimatePresence>
          {failed && status.errorMessage && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300"
            >
              {status.errorMessage}
            </motion.p>
          )}
        </AnimatePresence>

        {basescan && (
          <Button
            asChild
            variant="outline"
            className="mt-4 h-10 w-full gap-1.5 border-white/10 text-xs font-medium text-[#F2F5F8] transition-all duration-200 hover:border-[#0052FF]/50 hover:bg-[#0052FF]/10"
          >
            <a href={basescan} target="_blank" rel="noreferrer">
              View on BaseScan <ExternalLink size={13} />
            </a>
          </Button>
        )}
      </Card>
    </motion.div>
  );
}

function StatusBadge({
  failed,
  final,
  status,
}: {
  failed: boolean;
  final: boolean;
  status: string;
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
        <CheckCircle2 size={12} /> Final
      </Badge>
    );
  }
  if (status === 'confirmed') {
    return (
      <Badge className="gap-1 border-0 bg-[#0052FF]/15 text-[#5b8bff]">
        <CheckCircle2 size={12} /> Confirmed
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 border-0 bg-[#0052FF]/12 text-[#5b8bff]">
      <Loader2 size={12} className="animate-spin" /> Pending
    </Badge>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-[#7E8896]">
        <Icon size={13} strokeWidth={1.75} />
        {label}
      </span>
      {children}
    </div>
  );
}

export default TransactionReceiptCard;
