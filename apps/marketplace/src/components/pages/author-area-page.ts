/*
 * File: /src/components/pages/author-area-page.ts                                       *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 13/09/2026                                                             *
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
import { customElement, property, state } from 'lit/decorators.js';
import type { User } from '@artaround/shared';
import '../ui/ui-page-header';
import '../ui/ui-filter-tabs';
import './contents-page';
import '../visits/visits-page';
import { __ } from '../../services/i18n.service';

type AuthorTab = 'items' | 'visits';

/**
 * Area Autore: i propri contenuti e visite, in un'unica vista.
 */
@customElement('author-area-page')
export class AuthorAreaPage extends LitElement {
  @property({ type: Object }) user: User | null = null;
  @state() private tab: AuthorTab = 'items';

  createRenderRoot() {
    return this;
  }

  render() {
    return html`
      <div class="space-y-5">
        <ui-page-header
          title=${__('Area Autore')}
          .description=${__('Crea e gestisci i tuoi contenuti: item e visite')}
          .help=${__(
            "Qui vedi solo i contenuti e le visite che hai creato tu. Per l'elenco completo di tutti gli item/visite del museo (anche di altri autori) usa le pagine Contenuti e Visite nel menu principale.",
          )}
        ></ui-page-header>

        <div class="mb-3">
          <ui-filter-tabs
            .tabs=${[
              { value: 'items', label: __('I miei Item') },
              { value: 'visits', label: __('Le mie visite') },
            ]}
            .value=${this.tab}
            @filter-change=${(e: CustomEvent) => (this.tab = e.detail.value as AuthorTab)}
          ></ui-filter-tabs>
        </div>

        ${this.tab === 'items'
          ? html`<contents-page .user=${this.user} authorOnly></contents-page>`
          : html`<visits-page .user=${this.user} authorArea></visits-page>`}
      </div>
    `;
  }
}
