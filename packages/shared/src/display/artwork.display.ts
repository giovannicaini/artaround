/*
 * File: /src/display/artwork.display.ts                                                 *
 * Project: @artaround/shared                                                            *
 * Last Modified: 19/02/2026                                                             *
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

/**
 * Etichette dei tipi di opera d'arte (ArtworkType).
 */
import { ArtworkType } from '../types/artwork.types';
import type { SelectOption } from './common';

export const ARTWORK_TYPE_META: Readonly<Record<ArtworkType, { label: string; icon: string }>> = {
  [ArtworkType.Painting]: { label: 'Dipinto', icon: '🖼️' },
  [ArtworkType.Drawing]: { label: 'Disegno', icon: '✏️' },
  [ArtworkType.Sculpture]: { label: 'Scultura', icon: '🗿' },
  [ArtworkType.Print]: { label: 'Stampa', icon: '🖨️' },
  [ArtworkType.Photograph]: { label: 'Fotografia', icon: '📷' },
  [ArtworkType.Installation]: { label: 'Installazione artistica', icon: '🎪' },
  [ArtworkType.NewMedia]: { label: 'Arte digitale', icon: '🎬' },
  [ArtworkType.ManuscriptBook]: { label: 'Manoscritto', icon: '📜' },
  [ArtworkType.DecorativeObject]: { label: 'Arti decorative', icon: '🏺' },
  [ArtworkType.Other]: { label: 'Altro', icon: '🎨' },
} as const;

export const ARTWORK_TYPE_OPTIONS_IT: ReadonlyArray<SelectOption<ArtworkType>> = (
  Object.values(ArtworkType) as ArtworkType[]
).map((type) => ({
  value: type,
  label: `${ARTWORK_TYPE_META[type].icon} ${ARTWORK_TYPE_META[type].label}`,
}));

export function getArtworkTypeLabel(type: ArtworkType | string): string {
  return ARTWORK_TYPE_META[type as ArtworkType]?.label ?? type;
}

export function getArtworkTypeIcon(type: ArtworkType | string): string {
  return ARTWORK_TYPE_META[type as ArtworkType]?.icon ?? '🎨';
}
