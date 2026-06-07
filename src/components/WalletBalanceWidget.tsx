import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  RefreshCw,
  Fuel,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { formatUsdc, formatUsd, truncateAddress } from '../lib/format';
import { addressUrl } from '../lib/base';
import { useWalletBalance } from '../hooks/useWalletBalance';

export interface WalletBalanceWidgetProps {
  address: string | null;
  className?: string;
  compact?: boolean;
}

export function WalletBalanceWidget({
  address,
  className = '',
  compact = false,
}: WalletBalanceWidgetProps) {
  const balance = useWalletBalance(address, { poll: true });
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }, [address]);

  const usdcNum = Number(balance.usdc);
  const explorer = addressUrl(address);

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-xl border border-white/8 bg-[#171B22] px-3 py-1.5 transition-all duration-200',
          className
        )}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#0052FF]/12">
          <Wallet size={13} strokeWidth={2} className="text-[#5b8bff]" />
        </span>
        {balance.loading && balance.lastUpdated === null ? (
          <Skeleton className="h-4 w-20 bg-white/8" />
        ) : (
          <span className="text-sm font-semibold tabular-nums text-[#F2F5F8]">
            {formatUsdc(usdcNum)}{' '}
            <span className="text-xs font-medium text-[#7E8896]">USDC</span>
          </span>
        )}
        <button
          onClick={() => balance.refresh()}
          className="text-[#7E8896] transition-colors duration-200 hover:text-[#F2F5F8]"
          aria-label="Refresh balance"
        >
          <RefreshCw
            size={13}
            className={cn('transition-transform', balance.loading && 'animate-spin')}
          />
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={className}
    >
      <Card className="overflow-hidden border-white/8 bg-[#171B22]">
        <div className="relative p-4">
          {/* subtle accent glow */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#0052FF]/10 blur-2xl" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0052FF]/12">
                <Wallet size={15} strokeWidth={2} className="text-[#5b8bff]" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7E8896]">
                Base wallet
              </span>
            </div>
            <button
              onClick={() => balance.refresh()}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7E8896] transition-all duration-200 hover:bg-white/5 hover:text-[#F2F5F8]"
              aria-label="Refresh balance"
            >
              <RefreshCw
                size={14}
                className={cn('transition-transform', balance.loading && 'animate-spin')}
              />
            </button>
          </div>

          {/* USDC balance */}
          <div className="mt-3.5">
            {balance.loading && balance.lastUpdated === null ? (
              <Skeleton className="h-9 w-32 bg-white/8" />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={balance.usdc}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-baseline gap-1.5"
                >
                  <span className="font-display text-3xl font-bold tabular-nums text-[#F2F5F8]">
                    {formatUsdc(usdcNum)}
                  </span>
                  <span className="text-sm font-medium text-[#7E8896]">USDC</span>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Gas + address row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {balance.loading && balance.lastUpdated === null ? (
              <Skeleton className="h-6 w-24 bg-white/8" />
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      className={cn(
                        'gap-1 border-0 font-normal',
                        balance.hasGas
                          ? 'bg-[#3EE6A8]/12 text-[#3EE6A8]'
                          : 'bg-amber-500/12 text-amber-300'
                      )}
                    >
                      <Fuel size={11} />
                      {Number(balance.eth).toFixed(5)} ETH
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="border-white/10 bg-[#171B22] text-xs text-[#F2F5F8]">
                    {balance.hasGas
                      ? `Gas available${
                          balance.ethUsd != null ? ` \u00B7 ${formatUsd(balance.ethUsd)}` : ''
                        }`
                      : 'No gas \u2014 add ETH on Base to send'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {address && (
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-full border border-white/8 px-2.5 py-1 text-[11px] font-mono text-[#7E8896] transition-all duration-200 hover:border-white/15 hover:text-[#F2F5F8]"
              >
                {truncateAddress(address)}
                {copied ? (
                  <Check size={11} className="text-[#3EE6A8]" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
            )}

            {explorer && (
              <a
                href={explorer}
                target="_blank"
                rel="noreferrer"
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/8 text-[#7E8896] transition-all duration-200 hover:border-[#0052FF]/40 hover:text-[#5b8bff]"
                aria-label="View on BaseScan"
              >
                <ExternalLink size={11} />
              </a>
            )}
          </div>

          <AnimatePresence>
            {balance.error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px] text-amber-300"
              >
                <AlertTriangle size={13} />
                {balance.error}
              </motion.div>
            )}
          </AnimatePresence>

          {!balance.error && balance.isEmpty && !balance.loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[11px] text-[#7E8896]"
            >
              <TrendingUp size={13} className="text-[#5b8bff]" />
              Top up USDC on Base to start sending.
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export default WalletBalanceWidget;
