import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Coins, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PhoneNumberInput } from './PhoneNumberInput';
import type { CountryCode } from '../lib/phone';
import { USDC_SYMBOL } from '../lib/base';

export interface SendComposerProps {
  /** When set, the recipient is locked to an existing thread's phone */
  lockedPhone?: string | null;
  /** Pre-fill the recipient field (e.g. from a starter chip) */
  initialPhone?: string;
  /** Pre-fill the amount field */
  initialAmount?: string;
  /** Disable while a send is in flight */
  busy?: boolean;
  error?: string | null;
  /** Plain text send (when no amount supplied) */
  onSendText?: (body: string) => void;
  /** Initiate a payment send */
  onSendPayment: (phone: string, amount: string, token: string) => void;
  className?: string;
  autoFocus?: boolean;
}

/**
 * Bottom sticky chat-style composer mirroring a native messaging input:
 * recipient phone field (or locked thread) + amount + token + send.
 */
export function SendComposer({
  lockedPhone,
  initialPhone = '',
  initialAmount = '',
  busy = false,
  error,
  onSendText,
  onSendPayment,
  className = '',
  autoFocus = false,
}: SendComposerProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [phoneValid, setPhoneValid] = useState(false);
  const [country, setCountry] = useState<CountryCode>('ES' as CountryCode);
  const [amount, setAmount] = useState(initialAmount);
  const [token, setToken] = useState(USDC_SYMBOL);
  const [text, setText] = useState('');
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPhone) setPhone(initialPhone);
  }, [initialPhone]);
  useEffect(() => {
    if (initialAmount) setAmount(initialAmount);
  }, [initialAmount]);

  const effectivePhone = lockedPhone || phone;
  const amountNum = Number(String(amount).replace(',', '.'));
  const hasAmount = !!amount && amountNum > 0;
  const canSendPayment =
    !busy && hasAmount && (lockedPhone ? true : phoneValid);
  const canSendText = !busy && !!text.trim() && (lockedPhone ? true : phoneValid);

  const handlePay = useCallback(() => {
    if (!canSendPayment) return;
    onSendPayment(effectivePhone, amount, token);
    setAmount('');
  }, [canSendPayment, onSendPayment, effectivePhone, amount, token]);

  const handleText = useCallback(() => {
    if (!canSendText) return;
    onSendText?.(text.trim());
    setText('');
  }, [canSendText, onSendText, text]);

  const onPhoneChange = useCallback(
    (val: string, c: CountryCode | null, valid: boolean) => {
      setPhone(val);
      if (c) setCountry(c);
      setPhoneValid(valid);
    },
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'shrink-0 border-t border-white/6 bg-[#0E1116]/90 px-3 py-3 backdrop-blur-md',
        className
      )}
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300"
          >
            <AlertCircle size={13} /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recipient row (hidden when locked to a thread) */}
      {!lockedPhone && (
        <div className="mb-2">
          <PhoneNumberInput
            value={phone}
            onChange={onPhoneChange}
            country={country}
            onCountryChange={setCountry}
            placeholder="Recipient phone"
            size="sm"
            autoFocus={autoFocus}
          />
        </div>
      )}

      {/* Amount + token + send row */}
      <div className="flex items-stretch gap-2">
        <div className="flex flex-1 items-stretch rounded-xl border border-white/10 bg-[#1B2029] transition-all duration-200 focus-within:border-[#0052FF]/60 focus-within:ring-1 focus-within:ring-[#0052FF]/30">
          <div className="flex items-center pl-3 text-[#7E8896]">
            <Coins size={15} strokeWidth={1.6} />
          </div>
          <Input
            ref={amountRef}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value.replace(/[^0-9.,]/g, ''))
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePay();
            }}
            placeholder="Amount"
            inputMode="decimal"
            className="h-11 flex-1 border-0 bg-transparent text-base tabular-nums text-[#F2F5F8] placeholder:text-[#7E8896] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Select value={token} onValueChange={setToken}>
            <SelectTrigger className="h-11 w-[88px] shrink-0 border-0 border-l border-white/8 bg-transparent text-xs font-semibold text-[#F2F5F8] focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#171B22] text-[#F2F5F8]">
              <SelectItem value="USDC" className="text-xs focus:bg-white/5">
                USDC
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handlePay}
          disabled={!canSendPayment}
          className="h-11 min-w-[44px] gap-1.5 bg-[#0052FF] px-4 font-semibold text-white transition-all duration-200 hover:bg-[#0047db] active:scale-95 disabled:opacity-40"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          <span className="hidden sm:inline">Send</span>
        </Button>
      </div>

      {/* Optional text note (when a thread exists) */}
      {lockedPhone && onSendText && (
        <div className="mt-2 flex items-stretch gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleText();
            }}
            placeholder="Add a message\u2026"
            className="h-10 flex-1 rounded-xl border border-white/10 bg-[#1B2029] text-sm text-[#F2F5F8] placeholder:text-[#7E8896] focus-visible:border-[#0052FF]/40 focus-visible:ring-1 focus-visible:ring-[#0052FF]/20 focus-visible:ring-offset-0"
          />
          <Button
            variant="outline"
            onClick={handleText}
            disabled={!canSendText}
            className="h-10 border-white/10 bg-transparent px-3 text-xs text-[#F2F5F8] transition-all duration-200 hover:bg-white/5 disabled:opacity-40"
          >
            Send note
          </Button>
        </div>
      )}

      <p className="mt-2 px-1 text-[10px] text-[#5b6472]">
        USDC on Base \u00b7 confirmed on-chain in seconds
      </p>
    </motion.div>
  );
}

export default SendComposer;
