/*
 * File: /src/components/ui/ui-section.ts                                                *
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
import './ui-icon';

/**
 * Sezione di contenuto con titolo e icona, senza il wrapper a card.
 */
@customElement('ui-section')
export class UiSection extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) icon = '';
  @property({ type: String }) description = '';
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

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
    const hasHeader = this.title || this.description;

    return html`
      <section class="space-y-3">
        ${hasHeader
          ? html`
              <header class="flex items-start gap-3">
                ${this.icon
                  ? html`
                      <div
                        class="p-2 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                      >
                        <ui-icon name=${this.icon} size="sm"></ui-icon>
                      </div>
                    `
                  : nothing}
                <div>
                  ${this.title
                    ? html`
                        <h3 class="text-base font-semibold text-surface-900 dark:text-white">
                          ${this.title}
                        </h3>
                      `
                    : nothing}
                  ${this.description
                    ? html`
                        <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                          ${this.description}
                        </p>
                      `
                    : nothing}
                </div>
              </header>
            `
          : nothing}

        <div
          class="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 shadow-soft"
        >
          ${this.renderContent ? this.renderContent() : nothing}
        </div>
      </section>
    `;
  }
}
