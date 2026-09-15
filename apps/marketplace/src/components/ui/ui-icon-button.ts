/*
 * File: /src/components/ui/ui-icon-button.ts                                            *
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

import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';

/**
 * Bottone icona-soltanto con varianti di colore all'hover.
 */
@customElement('ui-icon-button')
export class UiIconButton extends LitElement {
  @property({ type: String }) icon = '';
  @property({ type: String }) title = '';
  @property({ type: String }) variant: 'default' | 'danger' | 'success' | 'brand' = 'default';
  @property({ type: String }) size: 'xs' | 'sm' | 'md' = 'sm';
  @property({ type: Boolean }) disabled = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Helper ──────────────────────────────────────────────
  private getVariantClasses(): string {
    const variants = {
      default:
        'text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20',
      danger:
        'text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20',
      success:
        'text-surface-400 hover:text-success-600 dark:hover:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20',
      brand:
        'text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20',
    };
    return variants[this.variant];
  }

  private getSizeClasses(): string {
    const sizes = {
      xs: 'p-1',
      sm: 'p-2',
      md: 'p-2.5',
    };
    return sizes[this.size];
  }

  private getIconSize(): string {
    const iconSizes = {
      xs: 'xs',
      sm: 'xs',
      md: 'sm',
    };
    return iconSizes[this.size] as 'xs' | 'sm' | 'md';
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <button
        type="button"
        title=${this.title}
        ?disabled=${this.disabled}
        class="${this.getSizeClasses()} ${this.getVariantClasses()} rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ui-icon name=${this.icon} size=${this.getIconSize()}></ui-icon>
      </button>
    `;
  }
}
