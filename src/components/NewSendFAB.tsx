import { motion } from 'framer-motion';
import { Plus, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Mobile floating action button to start a new send / focus the composer
 * on the recipient field. Thumb-reachable, accent-blue, with a soft spring.
 */

export interface NewSendFABProps {
  onClick: () => void;
  className?: string;
  visible?: boolean;
}

export function NewSendFAB({ onClick, className = '', visible = true }: NewSendFABProps) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className={cn('fixed bottom-24 right-5 z-40 lg:hidden', className)}
    >
      <Button
        onClick={onClick}
        aria-label="New send"
        className="group h-14 w-14 rounded-full bg-[#0052FF] p-0 shadow-[0_8px_28px_rgba(0,82,255,0.45)] hover:bg-[#0047db] active:scale-95 transition-all duration-200"
      >
        <span className="relative flex items-center justify-center">
          <Plus
            size={24}
            strokeWidth={2.25}
            className="text-white transition-all duration-200 group-hover:opacity-0 group-hover:rotate-90"
          />
          <Send
            size={20}
            strokeWidth={2}
            className="absolute text-white opacity-0 transition-all duration-200 group-hover:opacity-100"
          />
        </span>
      </Button>
    </motion.div>
  );
}

export default NewSendFAB;
