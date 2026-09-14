/*
 * File: /src/components/VisitMenuSheet.tsx                                              *
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

import { Info, MapPin, Settings } from 'lucide-react';
import { useT } from '../services/useT';
import { Sheet } from './ui';

interface VisitMenuSheetProps {
  open: boolean;
  onClose: () => void;
  hasAuthorInsight: boolean;
  hasMovementInsight: boolean;
  onOpenInsight: () => void;
  onOpenServices: () => void;
  onOpenSettings: () => void;
}

export function VisitMenuSheet({
  open,
  onClose,
  hasAuthorInsight,
  hasMovementInsight,
  onOpenInsight,
  onOpenServices,
  onOpenSettings,
}: VisitMenuSheetProps) {
  const t = useT();

  return (
    <Sheet open={open} onClose={onClose} title={t('Menu')}>
      <div className="space-y-2">
        {(hasAuthorInsight || hasMovementInsight) && (
          <button
            onClick={() => {
              onClose();
              onOpenInsight();
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
          >
            <Info className="w-5 h-5 text-brand-300" />
            <span className="font-medium">{t('Approfondimento')}</span>
          </button>
        )}
        <button
          onClick={() => {
            onClose();
            onOpenServices();
          }}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
        >
          <MapPin className="w-5 h-5 text-brand-300" />
          <span className="font-medium">{t('Servizi')}</span>
        </button>
        <button
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
        >
          <Settings className="w-5 h-5 text-brand-300" />
          <span className="font-medium">{t('Impostazioni')}</span>
        </button>
      </div>
    </Sheet>
  );
}
