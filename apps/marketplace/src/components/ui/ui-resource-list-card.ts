/*
 * File: /src/components/ui/ui-resource-list-card.ts                                     *
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
import './ui-card';
import './ui-badge';
import { __ } from '../../services/i18n.service';

/**
 * Card compatta per una risorsa in una lista (icona, titolo, meta).
 */
@customElement('ui-resource-list-card')
export class UiResourceListCard extends LitElement {
  @property({ type: String }) title = '';
  @property({ type: String }) emptyText = '';
  @property({ type: Number }) count = 0;
  @property({ type: String }) badgeVariant: 'secondary' | 'success' | 'warning' | 'danger' =
    'secondary';
  @property({ attribute: false }) renderItems: (() => unknown) | null = null;
  @property({ attribute: false }) renderActions: (() => unknown) | null = null;

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
    const resolvedEmptyText = this.emptyText || __('Nessun elemento');

    return html`
      <ui-card padding="none">
        <div
          class="px-5 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between gap-3"
        >
          <h3 class="font-semibold text-surface-900 dark:text-white">${this.title}</h3>
          <div class="flex items-center gap-2">
            ${this.renderActions ? this.renderActions() : nothing}
            <ui-badge
              .variant=${this.badgeVariant}
              size="sm"
              .label=${String(this.count)}
            ></ui-badge>
          </div>
        </div>

        <div class="divide-y divide-surface-200 dark:divide-surface-800">
          ${this.count === 0
            ? html`<p class="px-5 py-4 text-sm text-surface-500">${resolvedEmptyText}</p>`
            : this.renderItems
              ? this.renderItems()
              : nothing}
        </div>
      </ui-card>
    `;
  }
}
