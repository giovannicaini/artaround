/*
 * File: /src/components/ui/ui-loading.ts                                                *
 * Project: @artaround/marketplace                                                       *
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

import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Spinner di caricamento con testo opzionale.
 */
@customElement('ui-loading')
export class UiLoading extends LitElement {
  @property({ type: String }) text = '';
  @property({ type: String }) size: 'sm' | 'md' | 'lg' = 'md';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const sizeClasses = {
      sm: 'w-5 h-5 border',
      md: 'w-8 h-8 border-2',
      lg: 'w-12 h-12 border-3',
    };

    const spinnerClass = sizeClasses[this.size];

    return html`
      <div class="flex items-center justify-center py-12">
        <div class="text-center">
          <div
            class="${spinnerClass} border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"
          ></div>
          ${this.text
            ? html`<p class="text-sm text-surface-500 dark:text-surface-400">${this.text}</p>`
            : nothing}
        </div>
      </div>
    `;
  }
}
