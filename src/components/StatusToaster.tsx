import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import {
  WifiOff,
  XCircle,
  AlertTriangle,
  Loader2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

export type AppStatusKind =
  | 'offline'
  | 'tx-failed'
  | 'insufficient-balance'
  | 'recipient-unresolved'
  | 'auth-pending'
  | 'tx-pending';

export interface StatusToasterProps {
  /** Mount the toast region; place once near the app root */
  children?: never;
}

/**
 * Surfaces failure / lifecycle states as non-blocking toasts with retry
 * affordances. Mount once; trigger via the exported helpers.
 */
export function StatusToaster(_: StatusToasterProps) {
  // Bridge browser offline/online into toasts so the screen is never silent.
  useEffect(() => {
    const onOffline = () => showStatus('offline');
    const onOnline = () =>
      toast.success('Back online', {
        description: 'Connection restored.',
        duration: 2500,
      });
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  return (
    <Toaster
      position="top-center"
      theme="dark"
      richColors={false}
      toastOptions={{
        style: {
          background: '#171B22',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#F2F5F8',
          borderRadius: '12px',
          fontSize: '13px',
        },
      }}
    />
  );
}

interface StatusConfig {
  title: string;
  description: string;
  icon: React.ReactNode;
  type: 'error' | 'warning' | 'loading' | 'info';
}

const CONFIG: Record<AppStatusKind, StatusConfig> = {
  offline: {
    title: 'You\u2019re offline',
    description: 'Reconnect to send and confirm transactions.',
    icon: <WifiOff size={16} className="text-[#7E8896]" />,
    type: 'warning',
  },
  'tx-failed': {
    title: 'Transaction failed',
    description: 'The on-chain transfer didn\u2019t go through.',
    icon: <XCircle size={16} className="text-red-400" />,
    type: 'error',
  },
  'insufficient-balance': {
    title: 'Insufficient balance',
    description: 'Not enough USDC or ETH for gas on Base.',
    icon: <AlertTriangle size={16} className="text-amber-400" />,
    type: 'warning',
  },
  'recipient-unresolved': {
    title: 'Recipient not onboarded',
    description: 'We\u2019ll send them a claim link to receive funds.',
    icon: <HelpCircle size={16} className="text-[#0052FF]" />,
    type: 'info',
  },
  'auth-pending': {
    title: 'Awaiting verification',
    description: 'Approve the code in WhatsApp or SMS.',
    icon: <Loader2 size={16} className="animate-spin text-[#0052FF]" />,
    type: 'loading',
  },
  'tx-pending': {
    title: 'Confirming on Base\u2026',
    description: 'Your transfer is being confirmed on-chain.',
    icon: <Loader2 size={16} className="animate-spin text-[#0052FF]" />,
    type: 'loading',
  },
};

export interface ShowStatusOptions {
  description?: string;
  onRetry?: () => void;
  duration?: number;
}

/**
 * Trigger a status toast. Use anywhere in the app:
 *   showStatus('tx-failed', { onRetry: () => resend() })
 */
export function showStatus(kind: AppStatusKind, opts: ShowStatusOptions = {}) {
  const cfg = CONFIG[kind];
  if (!cfg) return;
  const description = opts.description ?? cfg.description;
  const duration =
    opts.duration ?? (cfg.type === 'loading' ? Infinity : 5000);

  toast.custom(
    (id) => (
      <div className="flex w-[340px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-xl border border-white/10 bg-[#171B22] px-4 py-3 shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
        <div className="mt-0.5 shrink-0">{cfg.icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#F2F5F8]">{cfg.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[#7E8896]">
            {description}
          </p>
          {opts.onRetry && (
            <button
              type="button"
              onClick={() => {
                opts.onRetry?.();
                toast.dismiss(id);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs font-medium text-[#F2F5F8] transition-all duration-200 hover:border-[#0052FF]/50 hover:bg-[#0052FF]/10"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          )}
        </div>
      </div>
    ),
    { duration }
  );
}

/** Dismiss any active status toast. */
export function dismissStatus() {
  toast.dismiss();
}

export default StatusToaster;
