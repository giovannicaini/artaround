/*
 * File: LoadingState.tsx                                                                *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 12/09/2026                                                             *
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

import { Compass } from 'lucide-react';
import { useT } from '../../services/useT';

interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
}

// Stato di caricamento centralizzato, usato da ogni pagina che carica dati.
export function LoadingState({ message, fullHeight = true }: LoadingStateProps) {
  const t = useT();
  return (
    <div
      className={`flex items-center justify-center ${fullHeight ? 'min-h-full' : 'py-16'}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full gradient-aurora opacity-25 blur-md animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center">
            <Compass className="w-7 h-7 text-brand-300 animate-[spin_2.5s_linear_infinite]" />
          </div>
        </div>
        <p className="text-surface-400 text-sm">{message || t('Caricamento...')}</p>
      </div>
    </div>
  );
}
