/*
 * File: /src/utils/inline-empty-state.ts                                                *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import { html, nothing } from 'lit';
import '../components/ui/ui-icon';

export interface InlineEmptyStateOptions {
  icon: string;
  text: string;
  subtext?: string;
}

/**
 * Stato vuoto compatto (icona sbiadita + testo) usato dentro tab/pannelli, più piccolo del riquadro a piena pagina di <ui-empty>.
 */
export function renderInlineEmptyState(options: InlineEmptyStateOptions) {
  const { icon, text, subtext } = options;
  return html`
    <div class="text-center py-8 text-surface-500 dark:text-surface-400">
      <ui-icon name=${icon} size="lg" class="mb-2 opacity-50"></ui-icon>
      <p>${text}</p>
      ${subtext ? html`<p class="text-sm mt-1">${subtext}</p>` : nothing}
    </div>
  `;
}
