/*
 * File: /src/components/ui/HighlightedText.tsx                                          *
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

import { useEffect, useRef } from 'react';

interface HighlightedTextProps {
  text: string;
  highlightUpTo: number; // charIndex da onBoundary — 0 significa niente ancora evidenziato
  className?: string;
}

// Il marker che guida lo scroll sta più avanti del confine evidenziato (circa una riga)
const SCROLL_LOOKAHEAD = 40;

// Testo con evidenziazione "karaoke"
export function HighlightedText({ text, highlightUpTo, className = '' }: HighlightedTextProps) {
  const boundaryRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (highlightUpTo > 0 && highlightUpTo <= text.length) {
      boundaryRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }, [highlightUpTo, text.length]);

  if (highlightUpTo <= 0 || highlightUpTo >= text.length) {
    return <p className={className}>{text}</p>;
  }

  const read = text.slice(0, highlightUpTo);
  const scrollMarkerIndex = Math.min(text.length, highlightUpTo + SCROLL_LOOKAHEAD);
  const upcoming = text.slice(highlightUpTo, scrollMarkerIndex);
  const unread = text.slice(scrollMarkerIndex);

  return (
    <p className={className}>
      <span className="text-surface-500">{read}</span>
      {upcoming}
      <span ref={boundaryRef} />
      {unread}
    </p>
  );
}
