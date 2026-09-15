/*
 * File: /src/components/ui/ui-checkbox.ts                                               *
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
import './ui-info-tip';

/**
 * Checkbox con etichetta e testo di aiuto opzionale.
 */
@customElement('ui-checkbox')
export class UiCheckbox extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) help = '';
  @property({ type: String }) hint = '';
  @property({ type: Boolean }) checked = false;
  @property({ type: Boolean }) disabled = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleChange(e: Event) {
    const target = e.target as HTMLInputElement;
    this.dispatchEvent(
      new CustomEvent('checkbox-change', {
        detail: { checked: target.checked },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <label class="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          .checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.handleChange}
          class="mt-1 w-4 h-4 rounded border-surface-300 dark:border-surface-600 text-brand-600 focus-glow disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div class="flex-1">
          ${this.label
            ? html`
                <span
                  class="inline-flex items-center gap-1.5 text-sm text-surface-700 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white transition-colors"
                >
                  ${this.label}
                  ${this.help ? html`<ui-info-tip text=${this.help}></ui-info-tip>` : nothing}
                </span>
              `
            : nothing}
          ${this.hint
            ? html`
                <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">${this.hint}</p>
              `
            : nothing}
        </div>
      </label>
    `;
  }
}
