/*
 * File: ServiceGrid.tsx                                                                 *
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

import { MARKER_TYPE_META, type MuseumService } from '@artaround/shared';
import { useT } from '@/services/useT';

interface ServiceGridProps {
  services: MuseumService[];
  onSelect: (service: MuseumService) => void;
  emptyMessage?: string;
}

// Griglia dei servizi del museo attivati dal curatore, icona+etichetta da MARKER_TYPE_META.
export function ServiceGrid({ services, onSelect, emptyMessage }: ServiceGridProps) {
  const t = useT();
  if (services.length === 0) {
    return emptyMessage ? <p className="text-sm text-surface-400">{emptyMessage}</p> : null;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {services.map((service) => (
        <button
          key={service.type}
          onClick={() => onSelect(service)}
          className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-800
            text-surface-300 hover:bg-surface-700 hover:text-brand-300 transition-colors"
        >
          <span className="text-2xl">{MARKER_TYPE_META[service.type].icon}</span>
          <span className="text-xs font-medium text-center leading-tight">
            {t(MARKER_TYPE_META[service.type].label)}
          </span>
        </button>
      ))}
    </div>
  );
}
