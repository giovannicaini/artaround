/*
 * File: /src/components/ui/ui-form-actions.ts                                           *
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
import './ui-button';
import { __ } from '../../services/i18n.service';

/**
 * Coppia di bottoni Annulla/Salva a fondo form.
 */
@customElement('ui-form-actions')
export class UiFormActions extends LitElement {
  @property({ type: String }) submitLabel = '';
  @property({ type: String }) cancelLabel = '';
  @property({ type: String }) submitIcon = 'save';
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) hideCancel = false;
  @property({ type: String }) submitVariant: 'primary' | 'danger' = 'primary';
  @property({ type: String }) cancelVariant: 'secondary' | 'ghost' = 'secondary';
  @property({ type: String }) align: 'left' | 'center' | 'right' | 'between' = 'right';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private handleSubmit() {
    this.dispatchEvent(new CustomEvent('submit', { bubbles: true, composed: true }));
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const resolvedSubmitLabel = this.submitLabel || __('Salva');
    const resolvedCancelLabel = this.cancelLabel || __('Annulla');

    const alignClasses = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return html`
      <div
        class="flex items-center gap-3 pt-6 border-t border-surface-200 dark:border-surface-700 ${alignClasses[
          this.align
        ]}"
      >
        ${!this.hideCancel
          ? html`
              <ui-button
                type="button"
                variant=${this.cancelVariant}
                .label=${resolvedCancelLabel}
                @click=${this.handleCancel}
                ?disabled=${this.loading}
              ></ui-button>
            `
          : nothing}
        <ui-button
          type="submit"
          variant=${this.submitVariant}
          .label=${resolvedSubmitLabel}
          icon=${this.submitIcon}
          .loading=${this.loading}
          ?disabled=${this.disabled}
          @click=${this.handleSubmit}
        ></ui-button>
      </div>
    `;
  }
}
