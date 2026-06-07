import { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isoToFlag, maskPhone, getPhoneCountry } from '../lib/phone';
import { truncateAddress } from '../lib/format';
import { MessageBubble } from './MessageBubble';
import { PhoneAddressChip } from './PhoneAddressChip';
import type { ThreadMessage } from '../hooks/useThreadMessages';
import type { Transaction } from '../hooks/useTransactions';
import type { Thread } from '../hooks/useThreads';

/**
 * Center conversation: chat-as-ledger. Renders ordered message bubbles
 * (text + payment) with auto-scroll, day separators, and loading / empty /
 * error states. Payment bubbles attach live on-chain receipts.
 */

export interface MessageThreadProps {
  thread: Thread | null;
  messages: ThreadMessage[];
  transactionsByMessage: (msg: ThreadMessage) => Transaction | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  className?: string;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toDateString();
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MessageThread({
  thread,
  messages,
  transactionsByMessage,
  loading,
  error,
  onRetry,
  className = '',
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the latest message.
  useEffect(() => {
    const el = bottomRef.current;
    if (el) {
      el.scrollIntoView({ behavior: messages.length > 0 ? 'smooth' : 'auto', block: 'end' });
    }
  }, [messages.length, thread?.id]);

  const iso = thread ? getPhoneCountry(thread.counterparty_phone) : null;

  // Group messages by day for separators.
  const grouped = useMemo(() => {
    const out: { key: string; label: string; items: ThreadMessage[] }[] = [];
    let currentKey = '';
    for (const m of messages) {
      const k = dayKey(m.created_at);
      if (k !== currentKey) {
        currentKey = k;
        out.push({ key: k, label: dayLabel(m.created_at), items: [m] });
      } else {
        out[out.length - 1].items.push(m);
      }
    }
    return out;
  }, [messages]);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      {/* Thread header */}
      {thread && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex shrink-0 items-center justify-between gap-3 border-b border-white/6 bg-[#0E1116]/70 px-4 py-2.5 backdrop-blur-md"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1E2530] text-lg">
              {isoToFlag(iso)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#F2F5F8]">
                {maskPhone(thread.counterparty_phone)}
              </p>
              <div className="mt-0.5">
                <PhoneAddressChip
                  phone={thread.counterparty_phone}
                  walletAddress={thread.counterparty_wallet}
                  size="sm"
                />
              </div>
            </div>
          </div>
          <Badge className="hidden shrink-0 gap-1 border-0 bg-[#3EE6A8]/12 text-[11px] font-normal text-[#3EE6A8] sm:flex">
            <ShieldCheck size={12} /> Base
          </Badge>
        </motion.div>
      )}

      {/* Messages */}
      <ScrollArea className="min-h-0 flex-1" ref={scrollRef as any}>
        <div className="flex flex-col gap-2.5 px-3 py-4 sm:px-5">
          {/* Loading */}
          {loading && messages.length === 0 && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}
                >
                  <Skeleton
                    className={cn(
                      'h-16 rounded-2xl bg-white/6',
                      i % 2 === 0 ? 'w-2/3' : 'w-1/2'
                    )}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-500/10">
                <AlertCircle size={22} className="text-red-300" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-[#F2F5F8]">Couldn\u2019t load messages</p>
              <p className="max-w-[260px] text-xs text-[#7E8896]">{error}</p>
              {onRetry && (
                <Button
                  variant="outline"
                  onClick={onRetry}
                  className="mt-1 h-9 gap-1.5 border-white/10 text-xs text-[#F2F5F8] hover:bg-white/5"
                >
                  <RefreshCw size={13} /> Retry
                </Button>
              )}
            </motion.div>
          )}

          {/* Empty thread (selected but no messages yet) */}
          {!loading && !error && messages.length === 0 && thread && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center gap-3 py-16 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5">
                <MessageSquare size={22} className="text-[#7E8896]" strokeWidth={1.5} />
              </span>
              <p className="text-sm font-medium text-[#F2F5F8]">No messages yet</p>
              <p className="max-w-[240px] text-xs leading-relaxed text-[#7E8896]">
                Type an amount below to send your first USDC to{' '}
                {maskPhone(thread.counterparty_phone)} on Base.
              </p>
            </motion.div>
          )}

          {/* Grouped messages */}
          {!error &&
            grouped.map((group) => (
              <div key={group.key} className="flex flex-col gap-2.5">
                <div className="my-1 flex items-center justify-center">
                  <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[#7E8896]">
                    {group.label}
                  </span>
                </div>
                {group.items.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    transaction={transactionsByMessage(m)}
                  />
                ))}
              </div>
            ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

export default MessageThread;
