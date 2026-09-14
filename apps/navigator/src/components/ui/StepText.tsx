/*
 * File: /src/components/ui/StepText.tsx                                                 *
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

import { HighlightedText } from './HighlightedText';

interface StepTextProps {
  text: string;
  active: boolean; // se false, spokenCharIndex appartiene a un altro testo a schermo: niente evidenziazione qui
  spokenCharIndex: number;
  emptyMessage: string;
  className: string;
}

// Testo della tappa (con evidenziazione "karaoke" se in ascolto), o il messaggio di ripiego se assente.
export function StepText({
  text,
  active,
  spokenCharIndex,
  emptyMessage,
  className,
}: StepTextProps) {
  if (!text) return <p className={className}>{emptyMessage}</p>;
  return (
    <HighlightedText
      text={text}
      highlightUpTo={active ? spokenCharIndex : 0}
      className={className}
    />
  );
}
