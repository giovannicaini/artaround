/*
 * File: /src/components/ui/ui-list-row.ts                                               *
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
 * Riga di lista con icona/avatar, titolo/sottotitolo e azioni a destra.
 */
@customElement('ui-list-row')
export class UiListRow extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) subtitle = '';
  @property({ type: Boolean }) disabled = false;
  @property({ attribute: false }) renderTrailing: (() => unknown) | null = null;

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
    return html`
      <button
        type="button"
        class="w-full px-5 py-4 flex items-center justify-between gap-3 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50 disabled:opacity-60 disabled:pointer-events-none"
        ?disabled=${this.disabled}
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-surface-900 dark:text-white truncate">${this.title}</p>
          ${this.subtitle
            ? html`<p class="text-xs text-surface-500 truncate mt-0.5">${this.subtitle}</p>`
            : nothing}
        </div>
        <div class="flex items-center gap-2">
          ${this.renderTrailing ? this.renderTrailing() : nothing}
        </div>
      </button>
    `;
  }
}
