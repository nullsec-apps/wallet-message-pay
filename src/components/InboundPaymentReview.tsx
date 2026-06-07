import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Loader2, X, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { flagMasked } from '../lib/phone';
import { formatUsdc } from '../lib/format';
import type { ParsedIntent } from '../lib/parseIntent';

/**
 * Surfaces a message-triggered transfer (parsed from inbound WhatsApp/SMS)
 * that requires explicit user approval before any on-chain execution.
 */

export interface InboundPaymentReviewProps {
  intent: ParsedIntent;
  channel: 'sms' | 'whatsapp';
  onApprove: () => Promise<void> | void;
  onReject: () => void;
  className?: string;
}

export function InboundPaymentReview({
  intent,
  channel,
  onApprove,
  onReject,
  className = '',
}: InboundPaymentReviewProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lowConfidence = intent.confidence === 'low';

  const handleApprove = async () => {
    if (busy || done) return;
    setBusy(true);
    try {
      await onApprove();
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={className}
    >
      <Card className="border-[#0052FF]/30 bg-[#171B22] p-4 sm:p-5 max-w-md">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0052FF]/15">
              <ShieldCheck size={18} strokeWidth={1.75} className="text-[#0052FF]" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#F2F5F8] truncate">
                Approve this {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} payment
              </p>
              <p className="text-xs text-[#7E8896] truncate">
                Triggered by an inbound message
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 border-white/10 text-[#7E8896] capitalize"
          >
            {channel}
          </Badge>
        </div>

        <div className="rounded-lg bg-[#0E1116] border border-white/6 p-3 space-y-2.5">
          <Row label="Amount">
            <span className="font-display text-base font-semibold text-[#F2F5F8]">
              {intent.amount != null ? formatUsdc(intent.amount) : '\u2014'}{' '}
              <span className="text-[#7E8896] text-xs">{intent.token}</span>
            </span>
          </Row>
          <Separator className="bg-white/6" />
          <Row label="Recipient">
            <span className="text-sm text-[#F2F5F8]">
              {intent.recipientPhone ? flagMasked(intent.recipientPhone) : '\u2014'}
            </span>
          </Row>
          <Separator className="bg-white/6" />
          <Row label="Message">
            <span className="text-xs text-[#7E8896] max-w-[60%] truncate text-right">
              \u201C{intent.rawBody || ''}\u201D
            </span>
          </Row>
        </div>

        {lowConfidence && (
          <Alert className="mt-3 border-amber-500/30 bg-amber-500/8">
            <AlertTriangle size={16} className="text-amber-400" />
            <AlertDescription className="text-xs text-amber-200/90">
              We weren\u2019t fully sure how to read this message. Double-check the
              amount and recipient before approving.
            </AlertDescription>
          </Alert>
        )}

        {done ? (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-[#3EE6A8]">
            <Check size={16} /> Approved \u2014 sending on Base
          </div>
        ) : (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={onReject}
              disabled={busy}
              className="flex-1 h-11 border-white/10 text-[#7E8896] hover:text-[#F2F5F8] hover:bg-white/5 transition-all duration-200"
            >
              <X size={16} className="mr-1.5" /> Dismiss
            </Button>
            <Button
              onClick={handleApprove}
              disabled={busy || !intent.amount || !intent.recipientPhone}
              className="flex-1 h-11 bg-[#0052FF] hover:bg-[#0047db] text-white font-medium transition-all duration-200 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="mr-1.5 animate-spin" /> Approving
                </>
              ) : (
                <>
                  <ShieldCheck size={16} className="mr-1.5" /> Approve &amp; send
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs uppercase tracking-wide text-[#7E8896]">{label}</span>
      {children}
    </div>
  );
}

export default InboundPaymentReview;
