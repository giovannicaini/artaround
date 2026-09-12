/*
 * File: VisitPriceBadge.tsx                                                             *
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

import { CheckCircle2 } from 'lucide-react';
import type { Visit } from '@artaround/shared';
import { Badge } from './ui/Badge';
import { useT } from '../services/useT';

interface VisitPriceBadgeProps {
  visit: Visit;
  owned: boolean;
}

// Badge con prezzo visita o "Acquistata"
export function VisitPriceBadge({ visit, owned }: VisitPriceBadgeProps) {
  const t = useT();
  if (owned) {
    return (
      <Badge variant="good" icon={<CheckCircle2 className="w-3 h-3" />}>
        {t('Acquistata')}
      </Badge>
    );
  }
  if (visit.metadata?.isFree) {
    return <Badge variant="good">{t('Gratis')}</Badge>;
  }
  return <Badge variant="neutral">€{visit.metadata?.price?.toFixed(2)}</Badge>;
}
