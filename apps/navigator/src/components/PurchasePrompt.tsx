/*
 * File: PurchasePrompt.tsx                                                              *
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

import { Lock } from 'lucide-react';
import { Button } from './ui/Button';
import { useT } from '../services/useT';
import { format } from '../services/i18n';

interface PurchasePromptProps {
  title: string;
  price: number;
}

// Usato per visita a pagamento non acquistata: rimanda al marketplace.
export function PurchasePrompt({ title, price }: PurchasePromptProps) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-2xl bg-brand-500/[.12] flex items-center justify-center">
        <Lock className="w-7 h-7 text-brand-400" />
      </div>
      <h3 className="font-display text-base font-semibold text-surface-50 mb-1.5">{title}</h3>
      <p className="text-surface-400 text-sm mb-5 max-w-xs">
        {format(
          t('Questa visita è a pagamento (€{price}) — acquistala dal marketplace per iniziarla.'),
          {
            price: price.toFixed(2),
          },
        )}
      </p>
      <Button
        variant="primary"
        onClick={() => {
          window.location.href = `${window.location.origin}/marketplace/`;
        }}
      >
        {t('Vai al marketplace')}
      </Button>
    </div>
  );
}
