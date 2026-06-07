import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Loader2,
  Fuel,
  ArrowRight,
  AlertTriangle,
  X,
  Lock,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatUsdc, formatUsd, truncateAddress } from '../lib/format';
import { flagMasked } from '../lib/phone';
import type { ResolvedRecipient } from '../hooks/usePhoneResolver';
import type { SendStage } from '../hooks/useSendPayment';

export interface SendConfirmSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipient: ResolvedRecipient | null;
  amount: string;
  token: string;
  stage: SendStage;
  error?: string | null;
  /** Live USDC balance string for the insufficient-balance check */
  usdcBalance?: string;
  /** Estimated gas in USD (from receipts / RPC), optional */
  gasUsd?: number | null;
  onConfirm: () => void;
}

/**
 * Explicit pre-send confirmation \u2014 the irreversible-action safety gate.
 * Shows amount, recipient (masked phone resolving to 0x), Base gas, chain,
 * and a USDC balance check before signing.
 */
export function SendConfirmSheet({
  open,
  onOpenChange,
  recipient,
  amount,
  token,
  stage,
  error,
  usdcBalance,
  gasUsd,
  onConfirm,
}: SendConfirmSheetProps) {
  const amountNum = Number(String(amount).replace(',', '.'));
  const balanceNum = usdcBalance !== undefined ? Number(usdcBalance) : null;
  const insufficient =
    balanceNum !== null && !isNaN(balanceNum) && amountNum > balanceNum;

  const signing = stage === 'signing';
  const resolving = stage === 'resolving';
  const pending = recipient ? !recipient.isClaimed || !recipient.walletAddress : true;

  const confirmLabel = useMemo(() => {
    if (signing) return 'Confirm in your wallet\u2026';
    if (pending) return `Send ${formatUsdc(amountNum)} ${token} (held)`;
    return `Send ${formatUsdc(amountNum)} ${token}`;
  }, [signing, pending, amountNum, token]);

  const canConfirm = !signing && !resolving && !insufficient && amountNum > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-3xl border-white/8 bg-[#171B22] px-5 pb-7 pt-5 text-[#F2F5F8]"
      >
        <SheetHeader className="text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-display text-base text-[#F2F5F8]">
              <ShieldCheck size={18} className="text-[#3EE6A8]" /> Review send
            </SheetTitle>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#7E8896] transition-colors duration-200 hover:bg-white/5 hover:text-[#F2F5F8]"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </SheetHeader>

        {/* Amount hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-4 flex flex-col items-center rounded-2xl border border-white/8 bg-[#1B2029] py-5"
        >
          <span className="text-[11px] font-medium uppercase tracking-wide text-[#7E8896]">
            You're sending
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-4xl font-bold tabular-nums text-[#F2F5F8]">
              {formatUsdc(amountNum)}
            </span>
            <span className="text-lg font-semibold text-[#7E8896]">{token}</span>
          </div>
          <Badge
            variant="outline"
            className="mt-2 border-[#0052FF]/30 bg-[#0052FF]/8 text-[10px] font-medium text-[#5b8bff]"
          >
            on Base
          </Badge>
        </motion.div>

        {/* Recipient + 0x resolution */}
        <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-[#1B2029] p-4">
          <Row label="To">
            <span className="font-medium text-[#F2F5F8]">
              {recipient ? flagMasked(recipient.phone) : '\u2014'}
            </span>
          </Row>
          <Separator className="bg-white/6" />
          <Row label="Wallet">
            {resolving ? (
              <span className="flex items-center gap-1.5 text-[#7E8896]">
                <Loader2 size={12} className="animate-spin" /> Resolving\u2026
              </span>
            ) : recipient?.walletAddress ? (
              <span className="flex items-center gap-1.5 font-mono text-[#3EE6A8]">
                <ArrowRight size={12} className="text-[#7E8896]" />
                {truncateAddress(recipient.walletAddress, 4)}
              </span>
            ) : (
              <Badge
                variant="outline"
                className="h-5 border-amber-500/25 bg-amber-500/8 text-[10px] text-amber-300"
              >
                <Lock size={9} className="mr-1" /> Pending claim
              </Badge>
            )}
          </Row>
          <Separator className="bg-white/6" />
          <Row label="Network fee">
            <span className="flex items-center gap-1.5 text-[#F2F5F8]">
              <Fuel size={12} className="text-[#7E8896]" />
              {gasUsd !== null && gasUsd !== undefined
                ? formatUsd(gasUsd)
                : '~$0.001'}
            </span>
          </Row>
          {balanceNum !== null && (
            <>
              <Separator className="bg-white/6" />
              <Row label="Your balance">
                <span
                  className={cn(
                    'tabular-nums',
                    insufficient ? 'text-red-400' : 'text-[#7E8896]'
                  )}
                >
                  {formatUsdc(balanceNum)} {token}
                </span>
              </Row>
            </>
          )}
        </div>

        {pending && !insufficient && (
          <Alert className="mt-3 border-amber-500/20 bg-amber-500/8 py-2.5">
            <AlertDescription className="text-[11px] leading-relaxed text-amber-200">
              This number isn't onboarded yet. Funds are held safely until they
              claim with a free Base wallet \u2014 they'll get a {recipient ? 'message' : 'link'}.
            </AlertDescription>
          </Alert>
        )}

        {insufficient && (
          <Alert className="mt-3 border-red-500/25 bg-red-500/10 py-2.5">
            <AlertTriangle size={14} className="text-red-400" />
            <AlertDescription className="text-[11px] leading-relaxed text-red-200">
              Insufficient USDC balance. Top up before sending.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <p className="mt-3 text-center text-xs text-red-400">{error}</p>
        )}

        <Button
          onClick={onConfirm}
          disabled={!canConfirm}
          className="mt-5 h-12 w-full gap-2 bg-[#0052FF] text-sm font-semibold text-white transition-all duration-200 hover:bg-[#0047db] active:scale-[0.99] disabled:opacity-50"
        >
          {signing ? (
            <>
              <Loader2 size={16} className="animate-spin" /> {confirmLabel}
            </>
          ) : (
            <>
              <ShieldCheck size={16} /> {confirmLabel}
            </>
          )}
        </Button>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-[#5b6472]">
          On-chain transfers are irreversible. Confirm the amount and recipient.
        </p>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[#7E8896]">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

export default SendConfirmSheet;
