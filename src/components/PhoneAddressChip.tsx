import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isoToFlag, maskPhone, getPhoneCountry } from '../lib/phone';
import { truncateAddress } from '../lib/format';
import { addressUrl } from '../lib/base';

export interface PhoneAddressChipProps {
  phone: string;
  /** Resolved 0x wallet address, if known */
  walletAddress?: string | null;
  /** Whether resolution is in flight */
  resolving?: boolean;
  /** Pulse blue while a payment is pending, settle green on finality */
  pulse?: 'idle' | 'pending' | 'final';
  /** Default face shown: phone (masked) or address */
  defaultFace?: 'phone' | 'address';
  className?: string;
  /** Compact variant for inline use inside bubbles */
  size?: 'sm' | 'md';
}

/**
 * Signature element: country-flag + masked phone-number token that flips to a
 * 0x address on tap, with a live on-chain confirmation pulse.
 */
export function PhoneAddressChip({
  phone,
  walletAddress,
  resolving = false,
  pulse = 'idle',
  defaultFace = 'phone',
  className = '',
  size = 'md',
}: PhoneAddressChipProps) {
  const [showAddress, setShowAddress] = useState(defaultFace === 'address');
  const [copied, setCopied] = useState(false);

  const iso = getPhoneCountry(phone);
  const flag = isoToFlag(iso);
  const masked = maskPhone(phone);
  const hasAddress = !!walletAddress;

  const flip = useCallback(() => {
    if (!hasAddress) return;
    setShowAddress((s) => !s);
  }, [hasAddress]);

  const copy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!walletAddress) return;
      try {
        await navigator.clipboard.writeText(walletAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {
        /* noop */
      }
    },
    [walletAddress]
  );

  const accent =
    pulse === 'final' ? '#3EE6A8' : pulse === 'pending' ? '#0052FF' : 'transparent';

  const padding = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            type="button"
            onClick={flip}
            whileTap={hasAddress ? { scale: 0.96 } : undefined}
            className={cn(
              'group relative inline-flex items-center gap-1.5 rounded-full border bg-[#1B2029] font-medium text-[#F2F5F8] transition-all duration-200 select-none overflow-hidden',
              padding,
              hasAddress
                ? 'cursor-pointer border-white/10 hover:border-[#0052FF]/50 hover:bg-[#1F2530]'
                : 'cursor-default border-white/8',
              className
            )}
            style={{ perspective: 600 }}
          >
            {/* confirmation pulse rail */}
            <AnimatePresence>
              {pulse !== 'idle' && (
                <motion.span
                  key={pulse}
                  className="pointer-events-none absolute left-0 top-0 h-full rounded-full"
                  style={{ background: accent, opacity: 0.16, width: '40%' }}
                  initial={{ x: '-40%' }}
                  animate={
                    pulse === 'pending'
                      ? { x: ['-40%', '140%'] }
                      : { x: '0%', width: '100%' }
                  }
                  transition={
                    pulse === 'pending'
                      ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }
                      : { duration: 0.5, ease: 'easeOut' }
                  }
                />
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait" initial={false}>
              {showAddress && hasAddress ? (
                <motion.span
                  key="addr"
                  className="relative z-[1] flex items-center gap-1.5"
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="font-mono tracking-tight">
                    {truncateAddress(walletAddress, 4)}
                  </span>
                  <span
                    onClick={copy}
                    className="flex h-4 w-4 items-center justify-center rounded text-[#7E8896] transition-colors hover:text-[#3EE6A8]"
                  >
                    {copied ? (
                      <Check size={12} className="text-[#3EE6A8]" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </span>
                </motion.span>
              ) : (
                <motion.span
                  key="phone"
                  className="relative z-[1] flex items-center gap-1.5"
                  initial={{ rotateY: -90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <span className="text-sm leading-none">{flag}</span>
                  <span className="tracking-tight">{masked}</span>
                  {resolving && (
                    <Loader2 size={12} className="animate-spin text-[#7E8896]" />
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </TooltipTrigger>
        <TooltipContent className="border-white/10 bg-[#171B22] text-[#F2F5F8]">
          {hasAddress ? (
            <div className="flex items-center gap-2">
              <span className="text-[#7E8896]">
                {showAddress ? 'Tap to show phone' : 'Tap to reveal 0x address'}
              </span>
              {addressUrl(walletAddress) && (
                <a
                  href={addressUrl(walletAddress)!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-0.5 text-[#0052FF] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  BaseScan <ExternalLink size={11} />
                </a>
              )}
            </div>
          ) : resolving ? (
            <span className="text-[#7E8896]">Resolving phone \u2192 0x\u2026</span>
          ) : (
            <span className="text-[#7E8896]">Not yet onboarded</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default PhoneAddressChip;
