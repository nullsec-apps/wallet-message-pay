import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Settings2,
  LogOut,
  ChevronLeft,
  Globe2,
} from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { flagMasked, isoToFlag, getPhoneCountry } from '../lib/phone';
import { truncateAddress } from '../lib/format';
import { WalletBalanceWidget } from './WalletBalanceWidget';
import { ThreadList } from './ThreadList';
import { NewSendFAB } from './NewSendFAB';
import type { Thread } from '../hooks/useThreads';

/**
 * Three-zone responsive shell: left thread rail, center thread, right receipt
 * rail (desktop). Mobile collapses to a thread-list home view that slides to a
 * full-screen conversation, with a floating New Send FAB and bottom composer.
 */

export interface AppShellProps {
  phone: string | null;
  walletAddress: string | null;
  threads: Thread[];
  threadsLoading: boolean;
  threadsError: string | null;
  activeThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewSend: () => void;
  onRefreshThreads: () => void;
  onLogout: () => void;
  center: ReactNode;
  right: ReactNode;
}

function logoUrl(): string | null {
  const ns = (typeof window !== 'undefined' && (window as any).__NULLSEC__) || {};
  return ns.logoUrl || null;
}

export function AppShell({
  phone,
  walletAddress,
  threads,
  threadsLoading,
  threadsError,
  activeThreadId,
  onSelectThread,
  onNewSend,
  onRefreshThreads,
  onLogout,
  center,
  right,
}: AppShellProps) {
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const iso = phone ? getPhoneCountry(phone) : null;
  const initials =
    (phone ? isoToFlag(iso) : '\uD83D\uDC64') || '\uD83D\uDC64';

  // When a thread is selected on mobile, slide into the conversation.
  useEffect(() => {
    if (activeThreadId) setMobileView('thread');
  }, [activeThreadId]);

  const handleSelect = useCallback(
    (id: string) => {
      onSelectThread(id);
      setMobileView('thread');
    },
    [onSelectThread]
  );

  const handleNewSend = useCallback(() => {
    onNewSend();
    setMobileView('thread');
  }, [onNewSend]);

  const logo = logoUrl();

  const Header = (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/6 bg-[#0E1116]/80 px-4 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-7 w-7"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0052FF]">
            <Send size={15} className="text-white" />
          </span>
        )}
        <div className="leading-tight">
          <p className="font-display text-sm font-bold text-[#F2F5F8]">Textpay</p>
          <p className="hidden text-[10px] text-[#7E8896] sm:block">USDC on Base</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-white/8 px-2.5 py-1 text-[11px] text-[#7E8896] md:flex">
          <Globe2 size={12} className="text-[#3EE6A8]" /> 90+ countries
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full border border-white/8 px-1 py-1 pr-2.5 transition-all duration-200 hover:border-white/15">
              <Avatar className="h-7 w-7 bg-[#1E2530] text-sm">
                <AvatarFallback className="bg-[#1E2530] text-base">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[120px] truncate text-xs text-[#F2F5F8] sm:inline">
                {phone ? flagMasked(phone).replace(/^\S+\s/, '') : 'Account'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-60 border-white/10 bg-[#171B22] text-[#F2F5F8]"
          >
            <DropdownMenuLabel className="text-[11px] font-normal text-[#7E8896]">
              {phone ? flagMasked(phone) : 'Signed in'}
            </DropdownMenuLabel>
            {walletAddress && (
              <DropdownMenuLabel className="pt-0 text-[11px] font-mono font-normal text-[#7E8896]">
                {truncateAddress(walletAddress)}
              </DropdownMenuLabel>
            )}
            <DropdownMenuSeparator className="bg-white/8" />
            <DropdownMenuItem className="gap-2 text-xs focus:bg-white/5">
              <Settings2 size={14} /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onLogout}
              className="gap-2 text-xs text-red-300 focus:bg-red-500/10 focus:text-red-300"
            >
              <LogOut size={14} /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#0E1116] text-[#F2F5F8]">
      {Header}

      {/* ---------- DESKTOP: three-zone ---------- */}
      <div className="hidden flex-1 overflow-hidden lg:flex">
        {/* Left rail */}
        <aside className="flex w-[320px] shrink-0 flex-col border-r border-white/6">
          <div className="shrink-0 p-3">
            <WalletBalanceWidget address={walletAddress} />
          </div>
          <Separator className="bg-white/6" />
          <ThreadList
            threads={threads}
            loading={threadsLoading}
            error={threadsError}
            activeThreadId={activeThreadId}
            onSelect={onSelectThread}
            onNewSend={onNewSend}
            onRefresh={onRefreshThreads}
            className="flex-1"
          />
        </aside>

        {/* Center thread */}
        <main className="flex min-w-0 flex-1 flex-col">{center}</main>

        {/* Right receipt rail */}
        <aside className="flex w-[360px] shrink-0 flex-col border-l border-white/6 p-4">
          {right}
        </aside>
      </div>

      {/* ---------- MOBILE: stacked sliding views ---------- */}
      <div className="relative flex-1 overflow-hidden lg:hidden">
        <AnimatePresence initial={false} mode="wait">
          {mobileView === 'list' ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col"
            >
              <div className="shrink-0 p-3">
                <WalletBalanceWidget address={walletAddress} />
              </div>
              <Separator className="bg-white/6" />
              <ThreadList
                threads={threads}
                loading={threadsLoading}
                error={threadsError}
                activeThreadId={activeThreadId}
                onSelect={handleSelect}
                onNewSend={handleNewSend}
                onRefresh={onRefreshThreads}
                className="flex-1"
              />
            </motion.div>
          ) : (
            <motion.div
              key="thread"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              className="flex h-full flex-col"
            >
              <button
                onClick={() => setMobileView('list')}
                className="flex h-11 shrink-0 items-center gap-1.5 border-b border-white/6 px-3 text-sm font-medium text-[#7E8896] transition-colors duration-200 hover:text-[#F2F5F8]"
              >
                <ChevronLeft size={18} /> All chats
              </button>
              <div className="flex min-h-0 flex-1 flex-col">{center}</div>
            </motion.div>
          )}
        </AnimatePresence>

        <NewSendFAB
          onClick={handleNewSend}
          visible={mobileView === 'list'}
        />
      </div>
    </div>
  );
}

export default AppShell;
