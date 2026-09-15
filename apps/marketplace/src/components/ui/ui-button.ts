/*
 * File: /src/components/ui/ui-button.ts                                                 *
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

/**
 * Bottone con varianti, dimensioni e stato di caricamento.
 */
@customElement('ui-button')
export class UiButton extends LitElement {
  @property({ type: String }) variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' =
    'primary';
  @property({ type: String }) size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
  @property({ type: String }) type: 'button' | 'submit' | 'reset' = 'button';
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) block = false;
  @property({ type: String }) label = '';
  @property({ type: String }) icon = '';

  // ─── Ciclo di vita ───────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = this.block ? 'block' : 'inline-block';
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('block')) {
      this.style.display = this.block ? 'block' : 'inline-block';
    }
  }

  // ─── Helper ──────────────────────────────────────────────
  private get baseClasses() {
    return 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none';
  }

  private get variantClasses() {
    const variants: Record<string, string> = {
      primary: 'gradient-aurora text-white shadow-glow hover:brightness-110 focus-glow',
      secondary: 'btn-gradient-secondary text-brand-700 dark:text-brand-300 focus-glow',
      ghost:
        'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800 focus-glow',
      danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 focus-glow-danger',
      outline: 'btn-gradient-outline text-brand-700 dark:text-brand-300 focus-glow',
    };
    return variants[this.variant];
  }

  private get sizeClasses() {
    const sizes: Record<string, string> = {
      xs: 'px-2.5 py-1.5 text-xs',
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-5 py-3 text-base',
    };
    return sizes[this.size];
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const classes = `${this.baseClasses} ${this.variantClasses} ${this.sizeClasses} ${this.block ? 'w-full' : ''}`;
    const iconSize = this.size === 'xs' || this.size === 'sm' ? 'xs' : 'sm';

    return html`
      <button
        type="${this.type}"
        class="${classes}"
        ?disabled=${this.disabled || this.loading}
        aria-busy=${this.loading}
      >
        ${this.loading
          ? html`
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            `
          : this.icon
            ? html` <ui-icon name="${this.icon}" size="${iconSize}"></ui-icon> `
            : nothing}
        ${this.label}
      </button>
    `;
  }
}
