/*
 * File: /src/components/ui/ProgressDots.tsx                                             *
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

interface ProgressDotsProps {
  total: number;
  current: number;
  onSelect?: (index: number) => void;
}

// Barra di avanzamento a segmenti (sotto alle tappe delle visite)
export function ProgressDots({ total, current, onSelect }: ProgressDotsProps) {
  return (
    <div
      className="flex gap-1.5"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }).map((_, idx) => (
        <button
          key={idx}
          type="button"
          aria-label={`Vai all'opera ${idx + 1} di ${total}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(idx);
          }}
          className={`h-1 flex-1 rounded-full transition-colors ${
            idx === current ? 'gradient-aurora' : idx < current ? 'bg-brand-800' : 'bg-surface-700'
          } ${onSelect ? 'cursor-pointer' : ''}`}
        />
      ))}
    </div>
  );
}
