import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconTile } from './IconTile';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Unico foglio modale dell'app: sale dal basso su mobile, centrato su
 * desktop. Usato da impostazioni, servizi rapidi, lista opere — prima
 * ognuno di questi era markup duplicato quasi identico in
 * VisitPlayerPage.tsx.
 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-surface-950/70 backdrop-blur-sm flex items-end lg:items-center lg:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full lg:w-[26rem] lg:max-h-[85vh] max-h-[88vh] bg-surface-900 border border-surface-800
              rounded-t-3xl lg:rounded-3xl overflow-hidden shadow-2xl flex flex-col safe-bottom"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 bg-surface-700 rounded-full" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-800">
                <h2 className="font-display font-semibold text-surface-50">{title}</h2>
                <IconTile icon={<X />} variant="panel" size="sm" label="Chiudi" onClick={onClose} />
              </div>
            )}
            <div className="overflow-y-auto px-5 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
