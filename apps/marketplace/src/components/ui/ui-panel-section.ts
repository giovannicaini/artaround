/*
 * File: /src/components/ui/ui-panel-section.ts                                          *
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

import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import './ui-card';
import './ui-info-tip';

/**
 * Sezione di form con titolo, icona e contenuto dentro una card.
 */
@customElement('ui-panel-section')
export class UiPanelSection extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) icon = '';
  @property({ type: String }) iconColor = 'text-brand-500';
  @property({ type: String }) cardPadding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @property({ type: String }) description = '';
  @property({ type: String }) help = '';
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
    return html`
      <section>
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2 flex-wrap"
        >
          ${this.icon
            ? html`<ui-icon name=${this.icon} size="sm" class=${this.iconColor}></ui-icon>`
            : nothing}
          ${this.title}
          ${this.help
            ? html`<ui-info-tip variant="inline" text=${this.help}></ui-info-tip>`
            : nothing}
        </h3>
        <ui-card padding=${this.cardPadding}>
          ${this.description
            ? html`<p class="text-sm text-surface-500 mb-4">${this.description}</p>`
            : nothing}
          ${this.renderContent ? this.renderContent() : nothing}
        </ui-card>
      </section>
    `;
  }
}
