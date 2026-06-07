import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, MessageCircle, Smartphone, RotateCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { flagMasked } from '../lib/phone';
import type { LoginChannel } from '../hooks/usePrivyAuth';

export interface OTPVerificationProps {
  phone: string;
  channel: LoginChannel;
  verifying?: boolean;
  error?: string | null;
  onVerify: (code: string) => Promise<boolean> | void;
  onResend?: () => void;
  onBack?: () => void;
  className?: string;
}

/**
 * OTP code entry for WhatsApp/SMS login. Auto-submits on full code, supports
 * resend with cooldown, and falls back to manual entry. Calls Privy
 * loginWithCode via the parent. Uses a self-contained 6-box input (no extra deps).
 */
export function OTPVerification({
  phone,
  channel,
  verifying = false,
  error,
  onVerify,
  onResend,
  onBack,
  className = '',
}: OTPVerificationProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [cooldown, setCooldown] = useState(30);
  const submitted = useRef(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const code = digits.join('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (error) {
      submitted.current = false;
    }
  }, [error]);

  const handleComplete = useCallback(
    async (value: string) => {
      if (submitted.current || verifying) return;
      submitted.current = true;
      const ok = await onVerify(value);
      if (ok === false) submitted.current = false;
    },
    [onVerify, verifying]
  );

  const setAt = useCallback(
    (idx: number, val: string) => {
      const clean = val.replace(/\D/g, '');
      setDigits((prev) => {
        const next = [...prev];
        if (clean.length > 1) {
          // paste handling: distribute across boxes
          const chars = clean.slice(0, 6 - idx).split('');
          chars.forEach((c, i) => {
            next[idx + i] = c;
          });
          const lastFilled = Math.min(idx + chars.length, 5);
          inputs.current[lastFilled]?.focus();
        } else {
          next[idx] = clean;
          if (clean && idx < 5) inputs.current[idx + 1]?.focus();
        }
        const joined = next.join('');
        if (joined.length === 6) handleComplete(joined);
        return next;
      });
    },
    [handleComplete]
  );

  const handleKeyDown = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        setDigits((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx] = '';
          } else if (idx > 0) {
            next[idx - 1] = '';
            inputs.current[idx - 1]?.focus();
          }
          return next;
        });
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        inputs.current[idx - 1]?.focus();
      } else if (e.key === 'ArrowRight' && idx < 5) {
        inputs.current[idx + 1]?.focus();
      }
    },
    []
  );

  const handleResend = useCallback(() => {
    if (cooldown > 0) return;
    setDigits(['', '', '', '', '', '']);
    submitted.current = false;
    setCooldown(30);
    inputs.current[0]?.focus();
    onResend?.();
  }, [cooldown, onResend]);

  const ChannelIcon = channel === 'whatsapp' ? MessageCircle : Smartphone;
  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
  const channelColor = channel === 'whatsapp' ? '#3EE6A8' : '#0052FF';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn('w-full', className)}
    >
      <Card className="relative overflow-hidden border-white/8 bg-[#171B22] p-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-[#7E8896] transition-all duration-200 hover:bg-white/5 hover:text-[#F2F5F8]"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="flex flex-col items-center pt-2 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 18 }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: `${channelColor}1A` }}
          >
            <ChannelIcon size={26} style={{ color: channelColor }} strokeWidth={1.6} />
          </motion.span>

          <h2 className="mt-4 font-display text-xl font-bold text-[#F2F5F8]">
            Enter your code
          </h2>
          <p className="mt-1.5 max-w-[20rem] text-sm leading-relaxed text-[#7E8896]">
            We sent a 6-digit code via {channelLabel} to{' '}
            <span className="font-medium text-[#F2F5F8]">{flagMasked(phone)}</span>
          </p>
        </div>

        <div className="mt-6 flex justify-center gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={digits[i]}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={verifying}
              inputMode="numeric"
              maxLength={6}
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              className={cn(
                'h-12 w-11 rounded-xl border border-white/10 bg-[#1B2029] text-center text-lg font-semibold text-[#F2F5F8] transition-all duration-200',
                'focus:border-[#0052FF]/70 focus:outline-none focus:ring-1 focus:ring-[#0052FF]/30',
                'disabled:opacity-60'
              )}
            />
          ))}
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}

        <Button
          onClick={() => code.length === 6 && handleComplete(code)}
          disabled={code.length < 6 || verifying}
          className="mt-6 h-12 w-full gap-2 bg-[#0052FF] text-sm font-semibold text-white transition-all duration-200 hover:bg-[#0047db] disabled:opacity-50"
        >
          {verifying ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Verifying\u2026
            </>
          ) : (
            <>
              <Check size={16} /> Verify & continue
            </>
          )}
        </Button>

        <div className="mt-4 text-center text-xs text-[#7E8896]">
          Didn't get it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0}
            className={cn(
              'inline-flex items-center gap-1 font-medium transition-colors duration-200',
              cooldown > 0
                ? 'cursor-not-allowed text-[#7E8896]'
                : 'text-[#5b8bff] hover:text-[#0052FF]'
            )}
          >
            <RotateCw size={12} className={cn(cooldown > 0 && 'opacity-50')} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#5b6472]">
          Approve directly inside your {channelLabel} app, then return here.
          No seed phrases \u2014 your Base wallet is created automatically.
        </p>
      </Card>
    </motion.div>
  );
}

export default OTPVerification;
