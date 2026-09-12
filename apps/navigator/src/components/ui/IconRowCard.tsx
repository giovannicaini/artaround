/*
 * File: IconRowCard.tsx                                                                 *
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

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { PressableCard } from './Card';

interface IconRowCardProps {
  icon: ReactNode;
  label: string;
  value?: string; // se presente, etichetta+valore su due righe invece di una sola scritta
  onClick: () => void;
}

// Card cliccabile con icona, etichetta (ed eventuale testo troncato)
export function IconRowCard({ icon, label, value, onClick }: IconRowCardProps) {
  return (
    <PressableCard
      onClick={onClick}
      className={`p-4 flex gap-3 ${value ? 'items-start' : 'items-center'}`}
    >
      <div className="w-9 h-9 rounded-xl bg-brand-500/[.12] flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      {value ? (
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-bold uppercase tracking-wide text-surface-500 mb-0.5">
            {label}
          </p>
          <p className="text-sm text-surface-200 line-clamp-2">{value}</p>
        </div>
      ) : (
        <span className="flex-1 text-sm font-medium text-surface-200">{label}</span>
      )}
      <ChevronRight className={`w-4 h-4 text-surface-600 flex-shrink-0 ${value ? 'mt-0.5' : ''}`} />
    </PressableCard>
  );
}
