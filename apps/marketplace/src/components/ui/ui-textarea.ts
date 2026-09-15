/*
 * File: /src/components/ui/ui-textarea.ts                                               *
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
 * Area di testo multi-riga con etichetta e aiuto.
 */
@customElement('ui-textarea')
export class UiTextarea extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) help = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) value = '';
  @property({ type: String }) error = '';
  @property({ type: String }) hint = '';
  @property({ type: Number }) rows = 4;
  @property({ type: Number }) maxLength = 0;
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) showCount = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(
      new CustomEvent('textarea-change', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const textareaClasses = `
      block w-full px-3 py-2.5 text-sm rounded-lg border transition-colors duration-150
      bg-white dark:bg-surface-900
      text-surface-900 dark:text-white
      placeholder:text-surface-400 dark:placeholder:text-surface-500
      disabled:bg-surface-50 disabled:text-surface-500 disabled:cursor-not-allowed
      dark:disabled:bg-surface-800
      resize-none
      ${
        this.error
          ? 'border-danger-500 focus:border-danger-500 focus-glow-danger'
          : 'border-surface-300 dark:border-surface-600 focus:border-brand-500 focus-glow'
      }
    `;

    const charCount = this.value.length;
    const isOverLimit = this.maxLength > 0 && charCount > this.maxLength;

    return html`
      <div class="space-y-1.5">
        ${this.label
          ? html`
              <label
                class="flex items-center gap-1.5 text-sm font-medium text-surface-700 dark:text-surface-300"
              >
                ${this.label}
                ${this.required ? html`<span class="text-danger-500 ml-0.5">*</span>` : nothing}
                ${this.help ? html`<ui-info-tip text=${this.help}></ui-info-tip>` : nothing}
              </label>
            `
          : nothing}

        <textarea
          class="${textareaClasses}"
          rows="${this.rows}"
          placeholder="${this.placeholder}"
          .value="${this.value}"
          ?required="${this.required}"
          ?disabled="${this.disabled}"
          maxlength="${this.maxLength > 0 ? this.maxLength : ''}"
          aria-invalid="${this.error ? 'true' : 'false'}"
          @input="${this.handleInput}"
        ></textarea>

        <div class="flex items-center justify-between">
          <div>
            ${this.hint && !this.error
              ? html` <p class="text-xs text-surface-500 dark:text-surface-400">${this.hint}</p> `
              : nothing}
            ${this.error
              ? html`
                  <p
                    class="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1"
                    role="alert"
                  >
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fill-rule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    ${this.error}
                  </p>
                `
              : nothing}
          </div>

          ${this.showCount || this.maxLength > 0
            ? html`
                <p class="text-xs ${isOverLimit ? 'text-danger-500' : 'text-surface-400'}">
                  ${charCount}${this.maxLength > 0 ? `/${this.maxLength}` : ''}
                </p>
              `
            : nothing}
        </div>
      </div>
    `;
  }
}
