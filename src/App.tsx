import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LandingPage } from './pages/LandingPage';
import { WalletPage } from './pages/WalletPage';
import { StatusToaster } from './components/StatusToaster';
import { usePrivyAuth } from './hooks/usePrivyAuth';

/**
 * Root: drives the Privy SMS/WhatsApp auth state. Unauthenticated users see the
 * conversation-preview landing + login; authenticated users get the
 * chat-as-ledger wallet. A single shared auth instance flows to both pages.
 */
export default function App() {
  const auth = usePrivyAuth();
  const authenticated = useMemo(
    () => auth.stage === 'authenticated' && !!auth.privyUserId,
    [auth.stage, auth.privyUserId]
  );

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#0E1116] font-sans text-[#F2F5F8] antialiased">
      <StatusToaster />
      <AnimatePresence mode="wait">
        {authenticated ? (
          <motion.div
            key="wallet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WalletPage auth={auth} />
          </motion.div>
        ) : (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LandingPage auth={auth} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
