import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Clock, Link2, Check, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { flagMasked } from '../lib/phone';
import { formatUsdc } from '../lib/format';

export interface RecipientOnboardingNoticeProps {
  phone: string;
  /** USDC amount held against the pending mapping */
  amount?: number | string | null;
  /** Whether the claim link send is in flight */
  sending?: boolean;
  /** Whether the claim link was already sent */
  sent?: boolean;
  onSendClaimLink?: () => void | Promise<void>;
  className?: string;
}

/**
 * Recipient-unresolved state: phone number isn't onboarded yet. Funds are held
 * against a pending wallet_mapping and a claim link is sent via WhatsApp/SMS.
 */
export function RecipientOnboardingNotice({
  phone,
  amount,
  sending = false,
  sent = false,
  onSendClaimLink,
  className = '',
}: RecipientOnboardingNoticeProps) {
  const [busy, setBusy] = useState(false);

  const handleSend = async () => {
    if (!onSendClaimLink || sending || busy) return;
    setBusy(true);
    try {
      await onSendClaimLink();
    } finally {
      setBusy(false);
    }
  };

  const isSending = sending || busy;
  const hasAmount = amount !== null && amount !== undefined && Number(amount) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <Card className="overflow-hidden border-white/10 bg-[#171B22] p-0">
        <div className="flex items-start gap-3 border-b border-white/8 px-4 py-3.5">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0052FF]/12">
            <Clock size={18} className="text-[#0052FF]" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-display text-sm font-semibold text-[#F2F5F8]">
                Recipient not onboarded yet
              </h4>
              <Badge
                variant="outline"
                className="border-[#0052FF]/30 bg-[#0052FF]/8 text-[10px] text-[#0052FF]"
              >
                Pending
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#7E8896]">
              <span className="font-medium text-[#F2F5F8]">{flagMasked(phone)}</span>{' '}
              hasn\u2019t set up a wallet. Send them a secure claim link to receive the
              funds \u2014 nothing leaves your wallet until they claim.
            </p>
          </div>
        </div>

        <div className="px-4 py-3">
          {hasAmount && (
            <Alert className="mb-3 border-[#3EE6A8]/20 bg-[#3EE6A8]/6">
              <ShieldCheck size={16} className="text-[#3EE6A8]" />
              <AlertDescription className="text-xs text-[#F2F5F8]">
                <span className="font-semibold text-[#3EE6A8]">
                  {formatUsdc(amount!)} USDC
                </span>{' '}
                held safely against a pending mapping until claimed.
              </AlertDescription>
            </Alert>
          )}

          {sent ? (
            <div className="flex items-center gap-2 rounded-lg border border-[#3EE6A8]/20 bg-[#3EE6A8]/6 px-3 py-2.5">
              <Check size={16} className="text-[#3EE6A8]" />
              <span className="text-xs font-medium text-[#F2F5F8]">
                Claim link sent \u2014 we\u2019ll notify you when they claim.
              </span>
            </div>
          ) : (
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="h-11 w-full bg-[#0052FF] font-medium text-white transition-all duration-200 hover:bg-[#0047db] disabled:opacity-60"
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Sending claim link\u2026
                </>
              ) : (
                <>
                  <Link2 size={16} className="mr-2" />
                  Send claim link via WhatsApp / SMS
                </>
              )}
            </Button>
          )}

          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] text-[#7E8896]">
            <Send size={11} />
            They claim inside their messaging app \u2014 no seed phrases.
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

export default RecipientOnboardingNotice;
