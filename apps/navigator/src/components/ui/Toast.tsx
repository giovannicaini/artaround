import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

interface ToastProps {
  open: boolean;
  icon?: ReactNode;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
}

/** Notifica leggera in basso, con un'azione opzionale — un solo posto in tutta l'app (vedi installazione PWA in App.tsx). */
export function Toast({ open, icon, message, actionLabel, onAction, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="fixed left-4 right-4 z-[60]"
          style={{ bottom: 'calc(1rem + var(--safe-area-inset-bottom))' }}
        >
          <div className="max-w-md mx-auto flex items-center gap-3 p-3 pl-3.5 rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl">
            {icon && <div className="flex-shrink-0">{icon}</div>}
            <p className="flex-1 text-sm text-surface-200 leading-snug min-w-0">{message}</p>
            {actionLabel && onAction && (
              <button
                onClick={onAction}
                className="flex-shrink-0 px-3.5 py-2 rounded-full gradient-aurora text-white text-xs font-bold whitespace-nowrap active:scale-95 transition-transform"
              >
                {actionLabel}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Chiudi"
              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
