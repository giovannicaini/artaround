/*
 * File: /src/components/ui/IconTile.tsx                                                 *
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

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type IconTileVariant = 'glass' | 'panel' | 'brand';
export type IconTileSize = 'sm' | 'md' | 'lg';

interface IconTileProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  variant?: IconTileVariant;
  size?: IconTileSize;
  label: string; // aria-label, sempre richiesta: sono bottoni a sola icona
}

const variantClasses: Record<IconTileVariant, string> = {
  glass: 'bg-black/45 text-white backdrop-blur-md hover:bg-black/65',
  panel: 'bg-surface-800 text-surface-200 border border-surface-700 hover:bg-surface-700',
  brand: 'gradient-aurora text-white shadow-glow',
};

const sizeClasses: Record<IconTileSize, string> = {
  sm: 'w-9 h-9 rounded-full [&>svg]:w-4 [&>svg]:h-4',
  md: 'w-11 h-11 rounded-full [&>svg]:w-5 [&>svg]:h-5',
  lg: 'w-14 h-14 rounded-2xl [&>svg]:w-6 [&>svg]:h-6',
};

// Bottone a sola icona (indietro, chiudi, impostazioni...).
export const IconTile = forwardRef<HTMLButtonElement, IconTileProps>(function IconTile(
  { icon, variant = 'panel', size = 'md', label, className = '', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center flex-shrink-0
        transition-all duration-200 active:scale-90
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
});
