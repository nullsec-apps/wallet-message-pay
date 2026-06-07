import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  CheckCircle2,
  Fuel,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CountryFlagStrip } from './CountryFlagStrip';

export interface LandingHeroProps {
  /** Primary CTA \u2014 continue with WhatsApp */
  onWhatsApp: () => void;
  /** Secondary CTA \u2014 continue with SMS */
  onSms: () => void;
  className?: string;
}

function logoUrl(): string | null {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return ns.logoUrl || null;
}

/**
 * First-load screen rendered as a real conversation preview \u2014 not a generic
 * centered hero. Shows '+34 612 \u2192 send 25 USDC' resolving phone\u21920x and an
 * animated 'Confirmed on Base' receipt chip.
 */
export function LandingHero({ onWhatsApp, onSms, className = '' }: LandingHeroProps) {
  // Stepped animation of the example send.
  const [step, setStep] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const sequence = [600, 1100, 1400, 2600];
    let i = 0;
    const advance = () => {
      setStep((s) => (s + 1) % 5);
      i = (i + 1) % sequence.length;
      timer.current = window.setTimeout(advance, sequence[i]);
    };
    timer.current = window.setTimeout(advance, sequence[0]);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const logo = logoUrl();
  const showResolved = step >= 2;
  const showConfirmed = step >= 3;

  return (
    <div
      className={cn(
        'relative min-h-[100dvh] overflow-hidden bg-[#0E1116] text-[#F2F5F8]',
        className
      )}
    >
      {/* Ambient accent glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-[#0052FF]/15 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-[#3EE6A8]/8 blur-[120px]" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-8 sm:px-8 lg:py-14">
        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2.5"
        >
          {logo ? (
            <img
              src={logo}
              alt=""
              className="h-8 w-8"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0052FF]">
              <MessageCircle size={17} className="text-white" />
            </span>
          )}
          <span className="font-display text-lg font-bold">Textpay</span>
          <Badge
            variant="outline"
            className="ml-1 hidden border-white/10 text-[10px] text-[#7E8896] sm:inline-flex"
          >
            USDC on Base
          </Badge>
        </motion.div>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-2 lg:gap-12">
          {/* Left: headline + CTAs */}
          <div className="flex flex-col">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]"
            >
              Send money by
              <br />
              <span className="text-[#0052FF]">texting</span> a phone number.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mt-5 max-w-md text-base leading-relaxed text-[#7E8896]"
            >
              Sign in with WhatsApp or SMS \u2014 no seed phrases. Text any number to
              send USDC on Base. Confirmed on-chain in seconds, anywhere in the
              world.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="mt-7 flex flex-col gap-3 sm:flex-row"
            >
              <Button
                onClick={onWhatsApp}
                className="group h-12 flex-1 gap-2 bg-[#0052FF] text-sm font-semibold text-white transition-all duration-200 hover:bg-[#0047db] active:scale-[0.99] sm:max-w-[260px]"
              >
                <MessageCircle size={17} />
                Continue with WhatsApp
                <ArrowRight
                  size={15}
                  className="transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </Button>
              <Button
                variant="outline"
                onClick={onSms}
                className="h-12 gap-2 border-white/12 bg-transparent text-sm font-medium text-[#F2F5F8] transition-all duration-200 hover:border-white/25 hover:bg-white/5"
              >
                Use SMS instead
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7E8896]"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#3EE6A8]" /> No seed phrases
              </span>
              <span className="flex items-center gap-1.5">
                <Zap size={14} className="text-[#3EE6A8]" /> Seconds to finality
              </span>
              <span className="flex items-center gap-1.5">
                <Fuel size={14} className="text-[#3EE6A8]" /> Cents in gas
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 hidden lg:block"
            >
              <CountryFlagStrip />
            </motion.div>
          </div>

          {/* Right: live thread preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="relative mx-auto w-full max-w-sm overflow-hidden border-white/8 bg-[#171B22] p-0">
              {/* thread header */}
              <div className="flex items-center gap-2.5 border-b border-white/6 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E2530] text-lg">
                  \uD83C\uDDEA\uD83C\uDDF8
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-[#F2F5F8]">+34 612 \u2022\u2022\u2022 \u2022\u2022\u2022</p>
                  <p className="text-[11px] text-[#7E8896]">Spain \u00b7 via WhatsApp</p>
                </div>
                <Badge
                  variant="outline"
                  className="ml-auto border-white/10 text-[9px] text-[#7E8896]"
                >
                  Example
                </Badge>
              </div>

              {/* thread body */}
              <div className="flex min-h-[280px] flex-col gap-3 bg-[#0E1116]/40 p-4">
                {/* outbound intent bubble */}
                <motion.div
                  initial={{ opacity: 0, x: 20, scale: 0.9 }}
                  animate={
                    step >= 0
                      ? { opacity: 1, x: 0, scale: 1 }
                      : { opacity: 0, x: 20, scale: 0.9 }
                  }
                  transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                  className="self-end"
                >
                  <div className="rounded-2xl rounded-br-md bg-[#1B2029] px-3.5 py-2 text-sm text-[#F2F5F8]">
                    send 25 USDC
                  </div>
                  <p className="mt-1 pr-1 text-right text-[10px] text-[#5b6472]">
                    14:32
                  </p>
                </motion.div>

                {/* payment receipt bubble with pulse */}
                <AnimatePresence>
                  {step >= 1 && (
                    <motion.div
                      initial={{ opacity: 0, x: 20, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      className="self-end"
                    >
                      <div
                        className="relative w-[230px] overflow-hidden rounded-2xl rounded-br-md border px-3.5 py-3"
                        style={{
                          borderColor: showConfirmed
                            ? '#3EE6A8'
                            : 'rgba(0,82,255,0.45)',
                          background: showConfirmed
                            ? 'rgba(62,230,168,0.08)'
                            : 'rgba(0,82,255,0.10)',
                          transition: 'all 0.5s ease',
                        }}
                      >
                        {/* travelling pulse */}
                        {!showConfirmed && (
                          <motion.span
                            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 rounded-full"
                            style={{ background: '#0052FF', opacity: 0.18 }}
                            animate={{ x: ['-40%', '320%'] }}
                            transition={{
                              repeat: Infinity,
                              duration: 1.3,
                              ease: 'easeInOut',
                            }}
                          />
                        )}
                        <div className="relative flex items-baseline justify-between">
                          <span className="font-display text-lg font-bold tabular-nums text-[#F2F5F8]">
                            25.00
                          </span>
                          <span className="text-xs font-semibold text-[#7E8896]">
                            USDC
                          </span>
                        </div>

                        {/* phone \u2192 0x resolution */}
                        <div className="relative mt-2 flex items-center gap-1.5 text-[11px]">
                          <AnimatePresence mode="wait">
                            {showResolved ? (
                              <motion.span
                                key="addr"
                                initial={{ opacity: 0, rotateY: -90 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-1 font-mono text-[#3EE6A8]"
                              >
                                0x7a3f\u20269c21
                              </motion.span>
                            ) : (
                              <motion.span
                                key="phone"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, rotateY: 90 }}
                                className="flex items-center gap-1 text-[#7E8896]"
                              >
                                <Lock size={10} /> resolving phone \u2192 0x\u2026
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* confirmation chip */}
                        <div className="relative mt-2.5 flex items-center justify-between border-t border-white/8 pt-2">
                          <AnimatePresence mode="wait">
                            {showConfirmed ? (
                              <motion.span
                                key="confirmed"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-1 text-[11px] font-medium text-[#3EE6A8]"
                              >
                                <CheckCircle2 size={12} /> Confirmed on Base
                              </motion.span>
                            ) : (
                              <motion.span
                                key="pending"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-[11px] font-medium text-[#5b8bff]"
                              >
                                Confirming\u2026
                              </motion.span>
                            )}
                          </AnimatePresence>
                          {showConfirmed && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[10px] tabular-nums text-[#7E8896]"
                            >
                              3.2s \u00b7 $0.001
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* recipient confirmation */}
                <AnimatePresence>
                  {step >= 4 && (
                    <motion.div
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="self-start"
                    >
                      <div className="rounded-2xl rounded-bl-md bg-[#1B2029] px-3.5 py-2 text-sm text-[#F2F5F8]">
                        Got it \u2014 thanks! \uD83D\uDE4F
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Mobile flag strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="lg:hidden"
        >
          <CountryFlagStrip />
        </motion.div>
      </div>
    </div>
  );
}

export default LandingHero;
