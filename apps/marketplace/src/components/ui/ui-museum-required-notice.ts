/*
 * File: /src/components/ui/ui-museum-required-notice.ts                                 *
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
import './ui-alert';
import './ui-button';
import { __ } from '../../services/i18n.service';

/**
 * Avviso quando manca un museo attivo selezionato.
 */
@customElement('ui-museum-required-notice')
export class UiMuseumRequiredNotice extends LitElement {
  @property({ type: String }) subject = 'risorse';
  @property({ type: String }) buttonLabel = '';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleSelectMuseum() {
    this.dispatchEvent(
      new CustomEvent('select-museum', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const resolvedButtonLabel = this.buttonLabel || __('Seleziona museo');

    const translatedSubject =
      this.subject === 'contenuti'
        ? __('Contenuti')
        : this.subject === 'visite'
          ? __('Visite')
          : this.subject === 'opere'
            ? __('opere fisiche nei musei')
            : __(this.subject);

    return html`
      <ui-alert
        variant="warning"
        .title=${__('Museo non selezionato')}
        .message=${`${__('Seleziona un museo per lavorare su')} ${translatedSubject}.`}
      ></ui-alert>
      <div class="flex justify-end">
        <ui-button
          variant="secondary"
          size="sm"
          .label=${resolvedButtonLabel}
          @click=${this.handleSelectMuseum}
        ></ui-button>
      </div>
    `;
  }
}
