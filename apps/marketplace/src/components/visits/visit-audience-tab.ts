/*
 * File: /src/components/visits/visit-audience-tab.ts                                    *
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
import { LANGUAGE_LEVEL_OPTIONS_EMOJI_IT, type LanguageLevel } from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import '../ui/ui-panel-section';
import '../ui/ui-checkbox';
import '../ui/ui-input';
import '../ui/ui-tag-input';

/**
 * Tab "Pubblico" del visit-editor: livelli di linguaggio, fascia d'età, durata stimata e interessi.
 */
@customElement('visit-audience-tab')
export class VisitAudienceTab extends LitElement {
  @property({ type: Array }) languageLevels: LanguageLevel[] = [];
  @property({ type: Number }) minAge: number | undefined = undefined;
  @property({ type: Number }) maxAge: number | undefined = undefined;
  @property({ type: Number }) estimatedDuration = 60;
  @property({ type: Array }) interests: string[] = [];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private get languageLevelOptions() {
    return LANGUAGE_LEVEL_OPTIONS_EMOJI_IT.map((option) => {
      const labelParts = option.label.split(' ');
      const icon = labelParts.shift() || '';
      const text = labelParts.join(' ');
      return {
        ...option,
        label: icon ? `${icon} ${__(text)}` : __(option.label),
      };
    });
  }

  private emitChange(detail: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent('audience-change', { detail, bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <div class="space-y-8">
        <ui-panel-section
          .title=${__('Livelli di linguaggio supportati')}
          icon="document"
          .description=${__('Seleziona i livelli per cui questa visita è adatta')}
          .help=${__(
            "Il visitatore sceglie il proprio livello nel Navigator prima di iniziare: per ogni tappa viene proposto automaticamente l'item scritto in quel livello, se esiste tra quelli collegati.",
          )}
          .renderContent=${() => html`
            <div class="space-y-2">
              ${this.languageLevelOptions.map(
                (option) => html`
                  <label
                    class="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-surface-50 dark:hover:bg-surface-800"
                  >
                    <ui-checkbox
                      .checked=${this.languageLevels.includes(option.value)}
                      @checkbox-change=${(e: CustomEvent) => {
                        const checked = e.detail.checked;
                        const languageLevels = checked
                          ? [...this.languageLevels, option.value]
                          : this.languageLevels.filter((l) => l !== option.value);
                        this.emitChange({ languageLevels });
                      }}
                    ></ui-checkbox>
                    <span class="text-sm text-surface-700 dark:text-surface-300"
                      >${option.label}</span
                    >
                  </label>
                `,
              )}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__("Fascia d'età")}
          icon="users"
          .help=${__(
            "Usata dal Navigator/Marketplace per suggerire questa visita nei risultati di ricerca in base all'età dichiarata dal visitatore — non blocca in alcun modo chi è fuori da questo intervallo.",
          )}
          .renderContent=${() => html`
            <div class="grid grid-cols-2 gap-4">
              <ui-input
                type="number"
                .label=${__('Età minima')}
                .placeholder=${__('Es. 8')}
                .value=${String(this.minAge || '')}
                @input=${(e: InputEvent) =>
                  this.emitChange({
                    minAge: parseInt((e.target as HTMLInputElement).value) || undefined,
                  })}
              ></ui-input>
              <ui-input
                type="number"
                .label=${__('Età massima')}
                .placeholder=${__('Es. 99')}
                .value=${String(this.maxAge || '')}
                @input=${(e: InputEvent) =>
                  this.emitChange({
                    maxAge: parseInt((e.target as HTMLInputElement).value) || undefined,
                  })}
              ></ui-input>
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Durata stimata')}
          icon="clock"
          .help=${__(
            'Tempo indicativo mostrato al visitatore prima di iniziare, e usato per filtrare/ordinare le visite proposte per durata — aggiornalo se aggiungi o togli tappe.',
          )}
          .renderContent=${() => html`
            <ui-input
              type="number"
              .label=${__('Durata (minuti)')}
              .placeholder=${__('Es. 60')}
              .value=${String(this.estimatedDuration)}
              @input=${(e: InputEvent) =>
                this.emitChange({
                  estimatedDuration: parseInt((e.target as HTMLInputElement).value) || 60,
                })}
            ></ui-input>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Interessi correlati')}
          icon="tag"
          .help=${__(
            'Parole chiave libere (es. "Arte barocca", "Scultura") usate solo per la ricerca/i filtri del catalogo — non compaiono al visitatore durante la visita.',
          )}
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Es. Arte barocca')}
              .tags=${this.interests}
              .lowercase=${false}
              .emptyText=${__('Nessun interesse aggiunto')}
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) =>
                this.emitChange({ interests: e.detail.tags })}
            ></ui-tag-input>
          `}
        ></ui-panel-section>
      </div>
    `;
  }
}
