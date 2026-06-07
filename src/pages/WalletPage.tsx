import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { MessageThread } from '../components/MessageThread';
import { SendComposer } from '../components/SendComposer';
import { SendConfirmSheet } from '../components/SendConfirmSheet';
import { TransactionReceiptCard } from '../components/TransactionReceiptCard';
import { EmptyThreadWalkthrough, type StarterChip } from '../components/EmptyThreadWalkthrough';
import { showStatus } from '../components/StatusToaster';
import { useUser } from '../hooks/useUser';
import { useThreads, type Thread } from '../hooks/useThreads';
import { useThreadMessages, type ThreadMessage } from '../hooks/useThreadMessages';
import { useTransactions, type Transaction } from '../hooks/useTransactions';
import { useSendPayment } from '../hooks/useSendPayment';
import { useWalletBalance } from '../hooks/useWalletBalance';
import type { UsePrivyAuth } from '../hooks/usePrivyAuth';

export interface WalletPageProps {
  auth: UsePrivyAuth;
}

/**
 * Authenticated shell: three-zone chat-as-ledger wallet. Threads on the left,
 * live message+payment thread in the center, on-chain receipt on the right.
 */
export function WalletPage({ auth }: WalletPageProps) {
  const { user, loading: userLoading } = useUser(auth.privyUserId);
  const ownerId = user?.id ?? null;
  const walletAddress = user?.wallet_address || auth.walletAddress || null;

  const {
    threads,
    loading: threadsLoading,
    error: threadsError,
    refresh: refreshThreads,
    getOrCreateThread,
  } = useThreads(ownerId);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const activeThread: Thread | null = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const {
    messages,
    loading: messagesLoading,
    error: messagesError,
    refresh: refreshMessages,
    sendText,
  } = useThreadMessages(activeThreadId, ownerId);

  const { transactions, getById } = useTransactions(ownerId);
  const balance = useWalletBalance(walletAddress, { poll: true });

  const send = useSendPayment();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [composerSeedPhone, setComposerSeedPhone] = useState('');
  const [composerSeedAmount, setComposerSeedAmount] = useState('');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [newSendMode, setNewSendMode] = useState(false);

  // Map a message to its transaction (for payment bubbles + receipts).
  const txByMessage = useCallback(
    (msg: ThreadMessage): Transaction | null => {
      if (msg.transaction_id) return getById(msg.transaction_id) || null;
      return null;
    },
    [getById]
  );

  // Auto-select most recent payment tx for the right rail.
  useEffect(() => {
    if (!selectedTxId && activeThreadId) {
      const threadTx = transactions.find((t) => t.thread_id === activeThreadId);
      if (threadTx) setSelectedTxId(threadTx.id);
    }
  }, [transactions, activeThreadId, selectedTxId]);

  const selectedTx: Transaction | null = useMemo(
    () => transactions.find((t) => t.id === selectedTxId) || null,
    [transactions, selectedTxId]
  );

  const handleSelectThread = useCallback((id: string) => {
    setActiveThreadId(id);
    setNewSendMode(false);
    setSelectedTxId(null);
  }, []);

  const handleNewSend = useCallback(() => {
    setActiveThreadId(null);
    setNewSendMode(true);
    setComposerSeedPhone('');
    setComposerSeedAmount('');
  }, []);

  const handleChip = useCallback((chip: StarterChip) => {
    setNewSendMode(true);
    setActiveThreadId(null);
    if (chip === 'topup') {
      showStatus('insufficient-balance', {
        description: 'Add USDC to your Base wallet to start sending.',
      });
    }
  }, []);

  // Initiate a payment from the composer.
  const handleSendPayment = useCallback(
    async (phone: string, amount: string) => {
      if (!balance.hasGas && balance.lastUpdated !== null) {
        showStatus('insufficient-balance', {
          description: 'No ETH for gas on Base. Top up a little ETH to send.',
        });
      }
      const rec = await send.prepare(phone, amount);
      if (!rec || rec.status === 'error') {
        showStatus('recipient-unresolved', {
          description: rec?.error || 'Could not resolve that number.',
        });
        return;
      }
      setConfirmOpen(true);
    },
    [send, balance.hasGas, balance.lastUpdated]
  );

  // Confirm + execute.
  const handleConfirm = useCallback(async () => {
    if (!ownerId || !walletAddress || !send.recipient) return;
    // Ensure a thread exists for this counterparty.
    const thread = await getOrCreateThread(
      send.recipient.phone,
      send.recipient.walletAddress
    );
    const result = await send.confirmAndSend({
      senderUserId: ownerId,
      senderWallet: walletAddress,
      threadId: thread?.id || null,
      initiatedVia: 'app',
    });

    if (result.status === 'failed') {
      showStatus('tx-failed', {
        description: result.error || 'The transfer did not go through.',
        onRetry: () => handleConfirm(),
      });
      return;
    }

    if (result.status === 'submitted' || result.status === 'recipient-pending') {
      setConfirmOpen(false);
      if (thread) {
        setActiveThreadId(thread.id);
        setNewSendMode(false);
      }
      if (result.transactionId) setSelectedTxId(result.transactionId);
      if (result.status === 'recipient-pending') {
        showStatus('recipient-unresolved', {
          description: 'Funds held \u2014 we sent a claim link to the recipient.',
        });
      } else {
        showStatus('tx-pending');
      }
      send.reset();
      refreshThreads();
      refreshMessages();
    }
  }, [ownerId, walletAddress, send, getOrCreateThread, refreshThreads, refreshMessages]);

  // Plain text note within a thread.
  const handleSendText = useCallback(
    (body: string) => {
      if (!ownerId) return;
      sendText(body, 'app');
    },
    [ownerId, sendText]
  );

  // ---------- Center pane ----------
  const showWalkthrough = !activeThread && !newSendMode;
  const lockedPhone = activeThread?.counterparty_phone || null;

  const Center = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col">
        <AnimatePresence mode="wait">
          {showWalkthrough ? (
            <motion.div
              key="walkthrough"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-1"
            >
              <EmptyThreadWalkthrough
                walletAddress={walletAddress}
                onChip={handleChip}
                className="flex-1"
              />
            </motion.div>
          ) : (
            <motion.div
              key={activeThreadId || 'new'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              {newSendMode && !activeThread ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-sm"
                  >
                    <h2 className="font-display text-xl font-bold text-[#F2F5F8]">
                      New send
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[#7E8896]">
                      Enter a recipient phone number and an amount below. We&rsquo;ll
                      resolve it to a wallet on Base and confirm on-chain in seconds.
                    </p>
                  </motion.div>
                </div>
              ) : (
                <MessageThread
                  thread={activeThread}
                  messages={messages}
                  transactionsByMessage={txByMessage}
                  loading={messagesLoading}
                  error={messagesError}
                  onRetry={refreshMessages}
                  className="flex-1"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!showWalkthrough && (
        <SendComposer
          lockedPhone={lockedPhone}
          initialPhone={composerSeedPhone}
          initialAmount={composerSeedAmount}
          busy={send.stage === 'resolving' || send.stage === 'signing'}
          error={send.stage === 'failed' ? send.error : null}
          onSendText={lockedPhone ? handleSendText : undefined}
          onSendPayment={handleSendPayment}
          autoFocus={newSendMode}
        />
      )}
    </div>
  );

  const Right = (
    <div className="flex h-full flex-col">
      <TransactionReceiptCard transaction={selectedTx} className="flex-1" />
    </div>
  );

  if (userLoading && !user) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-[#0E1116]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <Loader2 size={26} className="animate-spin text-[#0052FF]" />
          <p className="text-sm text-[#7E8896]">Loading your wallet\u2026</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        phone={user?.phone_number || auth.phone}
        walletAddress={walletAddress}
        threads={threads}
        threadsLoading={threadsLoading}
        threadsError={threadsError}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewSend={handleNewSend}
        onRefreshThreads={refreshThreads}
        onLogout={auth.logout}
        center={Center}
        right={Right}
      />

      <SendConfirmSheet
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o && send.stage !== 'signing') send.reset();
        }}
        recipient={send.recipient}
        amount={send.draft.amount}
        token={send.draft.token}
        stage={send.stage}
        error={send.error}
        usdcBalance={balance.usdc}
        gasUsd={null}
        onConfirm={handleConfirm}
      />
    </>
  );
}

export default WalletPage;
