/*
 * File: /src/components/ui/ui-list-controls.ts                                          *
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
import './ui-card';
import './ui-icon-button';

/**
 * Pannello filtri collassabile con riepilogo sempre visibile.
 */
@customElement('ui-list-controls')
export class UiListControls extends LitElement {
  @property({ type: String }) title = 'Opzioni elenco';
  @property({ type: String }) description = '';
  @property({ type: Boolean }) collapsed = true;
  @property({ attribute: false }) renderSummary: (() => unknown) | null = null;
  @property({ attribute: false }) renderContent: (() => unknown) | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Senza questo l'elemento resta inline: lo space-y del genitore non si applica.
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private toggle() {
    this.collapsed = !this.collapsed;
    this.dispatchEvent(
      new CustomEvent('collapsed-change', {
        detail: { collapsed: this.collapsed },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <ui-card padding="none">
        <div class="flex items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-surface-900 dark:text-white">${this.title}</h3>
            ${this.description
              ? html`
                  <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                    ${this.description}
                  </p>
                `
              : nothing}
          </div>

          <div class="flex items-center gap-2">
            ${this.renderSummary ? this.renderSummary() : nothing}
            <ui-icon-button
              icon=${this.collapsed ? 'chevron-down' : 'chevron-up'}
              title=${this.collapsed ? 'Espandi controlli' : 'Comprimi controlli'}
              @click=${this.toggle}
            ></ui-icon-button>
          </div>
        </div>

        ${this.collapsed
          ? nothing
          : html`
              <div
                class="border-t border-surface-200 dark:border-surface-800 px-4 pb-4 pt-3 space-y-4"
              >
                ${this.renderContent ? this.renderContent() : nothing}
              </div>
            `}
      </ui-card>
    `;
  }
}
