import { motion } from 'framer-motion';
import {
  MessageSquareDashed,
  Send,
  HandCoins,
  Plus,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WalletBalanceWidget } from './WalletBalanceWidget';

export type StarterChip = 'pay' | 'request' | 'topup';

export interface EmptyThreadWalkthroughProps {
  walletAddress: string | null;
  onChip: (chip: StarterChip) => void;
  className?: string;
}

const CHIPS: {
  key: StarterChip;
  label: string;
  hint: string;
  icon: any;
  accent: string;
}[] = [
  { key: 'pay', label: 'Pay a contact', hint: 'Send USDC by phone', icon: Send, accent: '#0052FF' },
  { key: 'request', label: 'Request', hint: 'Ask for a payment', icon: HandCoins, accent: '#3EE6A8' },
  { key: 'topup', label: 'Top up', hint: 'Add USDC on Base', icon: Plus, accent: '#7E8896' },
];

export function EmptyThreadWalkthrough({
  walletAddress,
  onChip,
  className = '',
}: EmptyThreadWalkthroughProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex h-full flex-col items-center justify-center overflow-y-auto px-5 py-8',
        className
      )}
    >
      <div className="w-full max-w-sm">
        {/* Icon + headline */}
        <div className="flex flex-col items-center text-center">
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0052FF]/10"
          >
            <MessageSquareDashed size={26} strokeWidth={1.5} className="text-[#5b8bff]" />
          </motion.span>
          <h2 className="mt-4 font-display text-xl font-bold text-[#F2F5F8] sm:text-2xl">
            Start your first send
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#7E8896]">
            Type a phone number, then an amount. We resolve it to a wallet on Base
            and confirm on-chain in seconds.
          </p>
        </div>

        {/* Ghosted composer preview */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.3 }}
          className="mt-6"
        >
          <Card className="border-dashed border-white/12 bg-[#171B22]/60 p-3.5">
            <div className="flex items-center gap-2 text-sm text-[#7E8896]">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5">
                \uD83C\uDF10
              </span>
              <span className="flex-1 italic">Type a phone number, then an amount\u2026</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0052FF]/40">
                <Send size={13} className="text-white" />
              </span>
            </div>
          </Card>
          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] text-[#7E8896]">
            <ArrowDown size={12} className="animate-bounce" /> pick a starter below
          </div>
        </motion.div>

        {/* Starter chips */}
        <div className="mt-5 grid grid-cols-1 gap-2.5">
          {CHIPS.map((chip, i) => {
            const Icon = chip.icon;
            return (
              <motion.button
                key={chip.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + i * 0.06, duration: 0.25 }}
                onClick={() => onChip(chip.key)}
                className="group flex items-center gap-3 rounded-xl border border-white/8 bg-[#171B22] px-3.5 py-3 text-left transition-all duration-200 hover:border-white/15 hover:bg-[#1E2530] active:scale-[0.99]"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
                  style={{ background: `${chip.accent}1f` }}
                >
                  <Icon size={17} strokeWidth={2} style={{ color: chip.accent }} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#F2F5F8]">{chip.label}</p>
                  <p className="text-[11px] text-[#7E8896]">{chip.hint}</p>
                </div>
                <Badge className="shrink-0 border-0 bg-white/5 text-[10px] font-normal text-[#7E8896]">
                  example
                </Badge>
              </motion.button>
            );
          })}
        </div>

        {/* Live balance widget — informative even at zero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42, duration: 0.3 }}
          className="mt-6"
        >
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7E8896]">
            <Sparkles size={12} className="text-[#3EE6A8]" /> Your live balance
          </div>
          <WalletBalanceWidget address={walletAddress} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export default EmptyThreadWalkthrough;
