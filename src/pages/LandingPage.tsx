import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { LandingHero } from '../components/LandingHero';
import { AuthLoginPanel } from '../components/AuthLoginPanel';
import { OTPVerification } from '../components/OTPVerification';
import type { UsePrivyAuth, LoginChannel } from '../hooks/usePrivyAuth';

export interface LandingPageProps {
  auth: UsePrivyAuth;
}

type View = 'hero' | 'login' | 'otp';

/**
 * Public entry: conversation-preview hero -> dual login panel -> OTP.
 * Drives the Privy SMS/WhatsApp flow; on auth success App swaps to WalletPage.
 */
export function LandingPage({ auth }: LandingPageProps) {
  const [view, setView] = useState<View>('hero');
  const [channel, setChannel] = useState<LoginChannel>('whatsapp');

  const startLogin = useCallback((c: LoginChannel) => {
    setChannel(c);
    setView('login');
  }, []);

  const handleSendCode = useCallback(
    async (phone: string, c: LoginChannel) => {
      setChannel(c);
      const ok = await auth.sendCode(phone, c);
      if (ok) setView('otp');
    },
    [auth]
  );

  const handleVerify = useCallback(
    async (code: string) => {
      const ok = await auth.loginWithCode(code);
      return ok;
    },
    [auth]
  );

  const handleResend = useCallback(() => {
    if (auth.phone) auth.sendCode(auth.phone, channel);
  }, [auth, channel]);

  const backToHero = useCallback(() => {
    auth.reset();
    setView('hero');
  }, [auth]);

  const backToLogin = useCallback(() => {
    auth.reset();
    setView('login');
  }, [auth]);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#0E1116]">
      <AnimatePresence mode="wait">
        {view === 'hero' && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <LandingHero
              onWhatsApp={() => startLogin('whatsapp')}
              onSms={() => startLogin('sms')}
            />
          </motion.div>
        )}

        {(view === 'login' || view === 'otp') && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative min-h-[100dvh] overflow-hidden"
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#0052FF]/12 blur-[120px]" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-[280px] w-[280px] rounded-full bg-[#3EE6A8]/6 blur-[120px]" />

            <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 py-8 sm:px-6">
              <button
                type="button"
                onClick={view === 'otp' ? backToLogin : backToHero}
                className="mb-4 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-sm font-medium text-[#7E8896] transition-colors duration-200 hover:text-[#F2F5F8]"
              >
                <ArrowLeft size={16} /> Back
              </button>

              <div className="flex flex-1 flex-col justify-center">
                <AnimatePresence mode="wait">
                  {view === 'login' ? (
                    <motion.div
                      key="login-panel"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.25 }}
                    >
                      <AuthLoginPanel
                        defaultChannel={channel}
                        stage={auth.stage}
                        error={auth.error}
                        onSendCode={handleSendCode}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="otp-panel"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.25 }}
                    >
                      <OTPVerification
                        phone={auth.phone || ''}
                        channel={channel}
                        verifying={auth.stage === 'verifying'}
                        error={auth.stage === 'error' ? auth.error : null}
                        onVerify={handleVerify}
                        onResend={handleResend}
                        onBack={backToLogin}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default LandingPage;
