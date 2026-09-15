/*
 * File: /src/components/museums/museum-languages-panel.ts                               *
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
import { SUPPORTED_APP_LANGUAGES, type AppLanguage } from '@artaround/shared';
import type { Job } from '../../services/jobs.service';
import { __ } from '../../services/i18n.service';
import { getAppLanguageLabel } from '../../utils/language-label';
import '../ui/ui-panel-section';
import '../ui/ui-language-select';
import '../ui/ui-checkbox';
import '../ui/ai-job-action';

/**
 * Sezione "Lingue attive" dell'editor museo, con gli strumenti AI di sincronizzazione.
 */
@customElement('museum-languages-panel')
export class MuseumLanguagesPanel extends LitElement {
  @property({ type: String }) primaryLanguage: AppLanguage = 'it';
  @property({ type: Array }) activeLanguages: AppLanguage[] = [];
  @property({ type: Boolean }) showAiTools = false;
  @property({ type: String }) museumId = '';
  @property({ type: Array }) jobs: Job[] = [];
  @property({ type: Boolean }) syncingLanguages = false;
  @property({ type: Boolean }) generatingAudio = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private emit(name: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <ui-panel-section
        icon="globe"
        iconColor="text-indigo-500"
        cardPadding="lg"
        .title=${__('Lingue attive')}
        .renderContent=${() => html`
          <div class="space-y-4">
            <ui-language-select
              .label=${__('Lingua principale del museo')}
              .value=${this.primaryLanguage}
              @select-change=${(e: CustomEvent<{ value: AppLanguage }>) =>
                this.emit('primary-language-change', { value: e.detail.value })}
            ></ui-language-select>

            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300"
              >${__('Lingue aggiuntive del museo')}</label
            >
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              ${SUPPORTED_APP_LANGUAGES.filter((lang) => lang !== this.primaryLanguage).map(
                (lang) => html`
                  <ui-checkbox
                    .label=${getAppLanguageLabel(lang)}
                    .checked=${this.activeLanguages.includes(lang)}
                    @checkbox-change=${(e: CustomEvent) =>
                      this.emit('active-language-toggle', {
                        lang,
                        checked: Boolean(e.detail.checked),
                      })}
                  ></ui-checkbox>
                `,
              )}
            </div>
            <p class="text-xs text-surface-500 dark:text-surface-400">
              ${__(
                'La lingua principale è quella usata per scrivere i contenuti di base. Le lingue aggiuntive saranno usate per traduzioni e contenuti multilingua.',
              )}
            </p>

            ${this.showAiTools
              ? html`
                  <div class="pt-2 border-t border-surface-200 dark:border-surface-700">
                    <h4
                      class="text-xs font-semibold uppercase tracking-wide text-surface-400 dark:text-surface-500"
                    >
                      ${__('Strumenti AI')}
                    </h4>
                    <div class="divide-y divide-surface-100 dark:divide-surface-800">
                      <ai-job-action
                        icon="translate"
                        jobType="sync-languages"
                        .museumId=${this.museumId}
                        .jobs=${this.jobs}
                        .loading=${this.syncingLanguages}
                        .label=${__('Sincronizza traduzioni esistenti')}
                        .description=${__(
                          'Applica le lingue attive ai contenuti e visite già presenti: rimuove traduzioni non richieste e genera con AI quelle mancanti.',
                        )}
                        .confirmTitle=${__('Sincronizzare le traduzioni?')}
                        .confirmMessage=${__(
                          "Applica le lingue attive ai contenuti e visite già presenti: rimuove traduzioni non richieste e genera con AI quelle mancanti. Può richiedere qualche minuto su un catalogo grande — segui l'avanzamento dalle notifiche.",
                        )}
                        @start=${() => this.emit('sync-languages')}
                      ></ai-job-action>
                      <ai-job-action
                        icon="sparkles"
                        jobType="generate-audio"
                        .museumId=${this.museumId}
                        .jobs=${this.jobs}
                        .loading=${this.generatingAudio}
                        .label=${__('Genera audio mancante')}
                        .description=${__(
                          "Genera con OpenAI (voce naturale + evidenziazione sincronizzata nel Navigator) l'audio mancante degli item davvero usati nelle visite del museo e delle tappe Info/Indicazioni — non tutto il catalogo, solo ciò che i visitatori ascoltano davvero.",
                        )}
                        .confirmTitle=${__("Generare l'audio mancante?")}
                        .confirmMessage=${__(
                          "Genera con OpenAI l'audio mancante degli item davvero usati nelle visite del museo. Operazione lunga e a pagamento (chiama OpenAI per ogni testo): non rigenera l'audio già presente. Segui l'avanzamento dalle notifiche.",
                        )}
                        @start=${() => this.emit('generate-audio')}
                      ></ai-job-action>
                    </div>
                  </div>
                `
              : nothing}
          </div>
        `}
      ></ui-panel-section>
    `;
  }
}
