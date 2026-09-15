/*
 * File: /src/components/ui/ui-stat-card.ts                                              *
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

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-card';
import './ui-icon';

/**
 * Card con un numero in evidenza, icona ed etichetta.
 */
@customElement('ui-stat-card')
export class UiStatCard extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: Number }) value = 0;
  @property({ type: String }) icon = 'chart';

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
      <ui-card padding="md">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-surface-500 dark:text-surface-400">${this.label}</p>
            <p class="text-2xl font-semibold text-surface-900 dark:text-white mt-1">
              ${this.value}
            </p>
          </div>
          <div class="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/30">
            <ui-icon
              name=${this.icon}
              size="sm"
              class="text-brand-600 dark:text-brand-400"
            ></ui-icon>
          </div>
        </div>
      </ui-card>
    `;
  }
}
