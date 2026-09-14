/*
 * File: Card.tsx                                                                        *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 02/09/2026                                                             *
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

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';

interface BaseProps {
  children: ReactNode;
  className?: string;
}

// Card statiche (info, testo).
export function Card({
  children,
  className = '',
  ...rest
}: BaseProps & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-surface-900 border border-surface-800 rounded-3xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

// Card cliccabile.
export function PressableCard({
  children,
  className = '',
  ...rest
}: BaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`bg-surface-900 border border-surface-800 rounded-3xl text-left w-full
        transition-all duration-300 hover:border-brand-500/50 hover:-translate-y-1 hover:shadow-glow
        active:scale-[0.98] active:translate-y-0 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
