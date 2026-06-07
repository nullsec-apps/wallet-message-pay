import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle,
  Smartphone,
  Loader2,
  ArrowRight,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PhoneNumberInput } from './PhoneNumberInput';
import { CountryFlagStrip } from './CountryFlagStrip';
import type { CountryCode } from '../lib/phone';
import type { LoginChannel, AuthStage } from '../hooks/usePrivyAuth';

export interface AuthLoginPanelProps {
  defaultChannel?: LoginChannel;
  stage: AuthStage;
  error?: string | null;
  onSendCode: (phone: string, channel: LoginChannel) => void;
  onBack?: () => void;
  className?: string;
}

/**
 * Dual login methods via Privy: WhatsApp vs SMS tabs with an international
 * phone input. Triggers sendCode for the chosen channel.
 */
export function AuthLoginPanel({
  defaultChannel = 'whatsapp',
  stage,
  error,
  onSendCode,
  onBack,
  className = '',
}: AuthLoginPanelProps) {
  const [channel, setChannel] = useState<LoginChannel>(defaultChannel);
  const [phone, setPhone] = useState('');
  const [valid, setValid] = useState(false);
  const [country, setCountry] = useState<CountryCode>('ES' as CountryCode);

  const sending = stage === 'sending';

  const handlePhone = useCallback(
    (val: string, c: CountryCode | null, isValid: boolean) => {
      setPhone(val);
      if (c) setCountry(c);
      setValid(isValid);
    },
    []
  );

  const handleSubmit = useCallback(() => {
    if (!valid || sending) return;
    onSendCode(phone, channel);
  }, [valid, sending, onSendCode, phone, channel]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('w-full', className)}
    >
      <Card className="relative overflow-hidden border-white/8 bg-[#171B22] p-6">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[#0052FF]/15 blur-[80px]" />

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[#7E8896] transition-all duration-200 hover:bg-white/5 hover:text-[#F2F5F8]"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        <div className="relative flex flex-col items-center pt-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0052FF]/12">
            <ShieldCheck size={22} className="text-[#0052FF]" strokeWidth={1.6} />
          </span>
          <h2 className="mt-3 font-display text-xl font-bold text-[#F2F5F8]">
            Sign in to Textpay
          </h2>
          <p className="mt-1.5 max-w-[22rem] text-sm leading-relaxed text-[#7E8896]">
            We'll send a one-time code to your phone. Your Base wallet is created
            automatically \u2014 no seed phrases.
          </p>
        </div>

        <Tabs
          value={channel}
          onValueChange={(v) => setChannel(v as LoginChannel)}
          className="relative mt-6"
        >
          <TabsList className="grid w-full grid-cols-2 gap-1 rounded-xl border border-white/8 bg-[#1B2029] p-1">
            <TabsTrigger
              value="whatsapp"
              className="gap-1.5 rounded-lg text-xs font-medium text-[#7E8896] transition-all duration-200 data-[state=active]:bg-[#0052FF] data-[state=active]:text-white"
            >
              <MessageCircle size={15} /> WhatsApp
            </TabsTrigger>
            <TabsTrigger
              value="sms"
              className="gap-1.5 rounded-lg text-xs font-medium text-[#7E8896] transition-all duration-200 data-[state=active]:bg-[#0052FF] data-[state=active]:text-white"
            >
              <Smartphone size={15} /> SMS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="mt-4">
            <ChannelBody label="WhatsApp" />
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            <ChannelBody label="SMS" />
          </TabsContent>
        </Tabs>

        <div className="mt-2">
          <PhoneNumberInput
            value={phone}
            onChange={handlePhone}
            country={country}
            onCountryChange={setCountry}
            placeholder="Your phone number"
            autoFocus
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 text-center text-xs text-red-400"
          >
            {error}
          </motion.p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!valid || sending}
          className="group mt-5 h-12 w-full gap-2 bg-[#0052FF] text-sm font-semibold text-white transition-all duration-200 hover:bg-[#0047db] active:scale-[0.99] disabled:opacity-50"
        >
          {sending ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Sending code\u2026
            </>
          ) : (
            <>
              {channel === 'whatsapp' ? (
                <MessageCircle size={16} />
              ) : (
                <Smartphone size={16} />
              )}
              Continue with {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              <ArrowRight
                size={15}
                className="transition-transform duration-200 group-hover:translate-x-0.5"
              />
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#5b6472]">
          By continuing you agree to receive a verification code. Standard
          messaging rates may apply.
        </p>

        <div className="mt-5 border-t border-white/6 pt-5">
          <CountryFlagStrip label="Active in 90+ countries" />
        </div>
      </Card>
    </motion.div>
  );
}

function ChannelBody({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-2 rounded-lg border border-white/6 bg-[#1B2029]/60 px-3 py-2 text-[11px] text-[#7E8896]"
    >
      <ShieldCheck size={13} className="shrink-0 text-[#3EE6A8]" />
      You'll approve the code inside {label} and return here automatically.
    </motion.div>
  );
}

export default AuthLoginPanel;
