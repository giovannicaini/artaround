/*
 * File: /src/components/ui/Toast.tsx                                                    *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

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

// Toast in basso (installazione PWA)
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
