import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquarePlus, Inbox, AlertCircle, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isoToFlag, maskPhone, getPhoneCountry } from '../lib/phone';
import { relativeTime } from '../lib/format';
import type { Thread } from '../hooks/useThreads';

export interface ThreadListProps {
  threads: Thread[];
  loading?: boolean;
  error?: string | null;
  activeThreadId?: string | null;
  onSelect: (thread: Thread) => void;
  onNewSend?: () => void;
  onRetry?: () => void;
  className?: string;
}

/**
 * Left rail / home tab listing phone-number contact threads. Each row shows
 * masked phone + country flag, last activity, with realtime-driven ordering.
 */
export function ThreadList({
  threads,
  loading = false,
  error = null,
  activeThreadId,
  onSelect,
  onNewSend,
  onRetry,
  className = '',
}: ThreadListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      (t.counterparty_phone || '').toLowerCase().includes(q.replace(/\s/g, ''))
    );
  }, [threads, query]);

  return (
    <div className={cn('flex h-full flex-col bg-[#0E1116]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-4 py-3.5">
        <h2 className="font-display text-base font-semibold text-[#F2F5F8]">
          Conversations
        </h2>
        {onNewSend && (
          <Button
            size="sm"
            onClick={onNewSend}
            className="h-8 gap-1.5 bg-[#0052FF] px-2.5 text-xs font-medium text-white transition-all duration-200 hover:bg-[#0047db]"
          >
            <MessageSquarePlus size={14} />
            New send
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#171B22] px-3 transition-all duration-200 focus-within:border-[#0052FF]/50">
          <Search size={15} className="shrink-0 text-[#7E8896]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by number"
            className="h-10 border-0 bg-transparent text-sm text-[#F2F5F8] placeholder:text-[#7E8896] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-4">
          {loading ? (
            <div className="space-y-1.5 px-1 pt-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                >
                  <Skeleton className="h-10 w-10 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32 bg-white/5" />
                    <Skeleton className="h-2.5 w-20 bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500/10">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <p className="mt-3 text-sm font-medium text-[#F2F5F8]">
                Couldn\u2019t load conversations
              </p>
              <p className="mt-1 max-w-[220px] text-xs text-[#7E8896]">{error}</p>
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="mt-3 h-8 gap-1.5 border-white/10 text-xs text-[#F2F5F8] hover:bg-white/5"
                >
                  <RefreshCw size={13} />
                  Retry
                </Button>
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0052FF]/10">
                <Inbox size={22} className="text-[#0052FF]" strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-sm font-medium text-[#F2F5F8]">
                {query ? 'No matches' : 'No conversations yet'}
              </p>
              <p className="mt-1 max-w-[230px] text-xs leading-relaxed text-[#7E8896]">
                {query
                  ? 'Try a different number.'
                  : 'Text a phone number to send USDC \u2014 every send becomes a conversation here.'}
              </p>
              {!query && onNewSend && (
                <Button
                  size="sm"
                  onClick={onNewSend}
                  className="mt-4 h-9 gap-1.5 bg-[#0052FF] text-xs font-medium text-white transition-all duration-200 hover:bg-[#0047db]"
                >
                  <MessageSquarePlus size={14} />
                  Start your first send
                </Button>
              )}
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((thread, idx) => {
                const iso = getPhoneCountry(thread.counterparty_phone);
                const flag = isoToFlag(iso);
                const active = thread.id === activeThreadId;
                const last = thread.last_message_at || thread.created_at;
                return (
                  <motion.button
                    key={thread.id}
                    type="button"
                    onClick={() => onSelect(thread)}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.16) }}
                    className={cn(
                      'group mb-0.5 flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-all duration-200',
                      active
                        ? 'bg-[#0052FF]/10 ring-1 ring-[#0052FF]/30'
                        : 'hover:bg-white/[0.04]'
                    )}
                  >
                    <Avatar className="h-10 w-10 shrink-0 border border-white/8 bg-[#1B2029]">
                      <AvatarFallback className="bg-transparent text-lg">
                        {flag}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'truncate text-sm font-medium tabular-nums',
                            active ? 'text-[#F2F5F8]' : 'text-[#F2F5F8]'
                          )}
                        >
                          {maskPhone(thread.counterparty_phone)}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#7E8896]">
                          {relativeTime(last)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {thread.counterparty_wallet ? (
                          <Badge
                            variant="outline"
                            className="h-4 border-[#3EE6A8]/25 bg-[#3EE6A8]/8 px-1.5 text-[9px] font-medium text-[#3EE6A8]"
                          >
                            On-chain
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="h-4 border-white/10 px-1.5 text-[9px] font-medium text-[#7E8896]"
                          >
                            Pending
                          </Badge>
                        )}
                        <span className="truncate text-xs text-[#7E8896]">
                          Tap to open thread
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default ThreadList;
