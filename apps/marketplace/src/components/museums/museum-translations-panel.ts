import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AppLanguage, MarkerType } from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import '../ui/ui-panel-section';
import '../ui/ui-button';
import '../ui/ui-badge';
import '../ui/ui-select';
import '../ui/ui-input';
import '../ui/ui-textarea';

export type TranslatableService = { type: MarkerType; label: string; value: string };

/**
 * Sezione "Traduzioni museo": nome/descrizione/orari/biglietti tradotti, con traduzione AI dei campi mancanti.
 */
@customElement('museum-translations-panel')
export class MuseumTranslationsPanel extends LitElement {
  @property({ type: Array }) targetLanguages: AppLanguage[] = [];
  @property({ type: String }) selectedLanguage: AppLanguage | null = null;
  @property({ type: String }) selectedLanguageLabel: string | null = null;
  @property({ type: Array }) languageOptions: Array<{ value: string; label: string }> = [];
  @property({ type: String }) sourceLanguageLabel = '';
  @property({ type: Boolean }) translating = false;
  @property({ type: String }) nameValue = '';
  @property({ type: String }) descriptionValue = '';
  @property({ type: String }) openingHoursValue = '';
  @property({ type: String }) ticketInfoValue = '';
  @property({ type: Array }) translatableServices: TranslatableService[] = [];

  createRenderRoot() {
    return this;
  }

  private emit(name: string, detail?: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  render() {
    return html`
      <ui-panel-section
        icon="languages"
        iconColor="text-violet-500"
        cardPadding="none"
        .title=${__('Traduzioni museo')}
        .renderContent=${() => html`
          <div
            class="p-6 space-y-5 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-100/80 dark:bg-violet-900/25"
          >
            <div
              class="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30"
            >
              <ui-button
                type="button"
                variant="secondary"
                icon="sparkles"
                .label=${__('Traduci campi mancanti con AI')}
                .loading=${this.translating}
                .disabled=${this.targetLanguages.length === 0}
                @click=${() => this.emit('translate-missing')}
              ></ui-button>
              <ui-badge
                variant="secondary"
                .label=${`${__('Lingua sorgente')}: ${this.sourceLanguageLabel}`}
              ></ui-badge>
              <p class="text-xs text-surface-500 dark:text-surface-400">
                ${__(
                  'Compila automaticamente nome, descrizione, orari e biglietti per le lingue aggiuntive non ancora tradotte.',
                )}
              </p>
            </div>

            ${this.targetLanguages.length === 0
              ? html`<p class="text-sm text-surface-600 dark:text-surface-300">
                  ${__(
                    'Aggiungi almeno una lingua aggiuntiva per inserire o generare traduzioni del museo.',
                  )}
                </p>`
              : nothing}
            ${this.targetLanguages.length > 0
              ? html`
                  <div class="space-y-3">
                    <ui-select
                      .label=${__('Lingua traduzione')}
                      .value=${this.selectedLanguage || ''}
                      .options=${this.languageOptions}
                      @select-change=${(e: CustomEvent<{ value: AppLanguage }>) =>
                        this.emit('language-change', { value: e.detail.value })}
                    ></ui-select>

                    ${this.selectedLanguage
                      ? html`
                          <div
                            class="p-4 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 space-y-4"
                          >
                            <h4 class="font-medium text-surface-900 dark:text-white">
                              ${__('Traduzioni in')}
                              ${this.selectedLanguageLabel || this.selectedLanguage.toUpperCase()}
                            </h4>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <ui-input
                                .label=${__('Nome museo')}
                                .value=${this.nameValue}
                                @input-change=${(e: CustomEvent) =>
                                  this.emit('field-change', {
                                    field: 'name',
                                    value: e.detail.value,
                                  })}
                              ></ui-input>
                            </div>

                            <ui-textarea
                              .label=${__('Descrizione')}
                              .value=${this.descriptionValue}
                              @textarea-change=${(e: CustomEvent) =>
                                this.emit('field-change', {
                                  field: 'description',
                                  value: e.detail.value,
                                })}
                              rows="3"
                            ></ui-textarea>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <ui-textarea
                                .label=${__('Orari di apertura')}
                                .value=${this.openingHoursValue}
                                @textarea-change=${(e: CustomEvent) =>
                                  this.emit('field-change', {
                                    field: 'openingHours',
                                    value: e.detail.value,
                                  })}
                                rows="3"
                              ></ui-textarea>

                              <ui-textarea
                                .label=${__('Informazioni biglietti')}
                                .value=${this.ticketInfoValue}
                                @textarea-change=${(e: CustomEvent) =>
                                  this.emit('field-change', {
                                    field: 'ticketInfo',
                                    value: e.detail.value,
                                  })}
                                rows="3"
                              ></ui-textarea>
                            </div>

                            ${this.translatableServices.length > 0
                              ? html`
                                  <div
                                    class="space-y-3 pt-3 border-t border-violet-300 dark:border-violet-700"
                                  >
                                    <h5
                                      class="text-sm font-medium text-surface-900 dark:text-white"
                                    >
                                      ${__('Servizi del museo')}
                                    </h5>
                                    ${this.translatableServices.map(
                                      (service) => html`
                                        <ui-textarea
                                          .label=${service.label}
                                          .value=${service.value}
                                          @textarea-change=${(e: CustomEvent) =>
                                            this.emit('service-translation-change', {
                                              type: service.type,
                                              value: e.detail.value,
                                            })}
                                          rows="2"
                                        ></ui-textarea>
                                      `,
                                    )}
                                  </div>
                                `
                              : nothing}
                          </div>
                        `
                      : nothing}
                  </div>
                `
              : nothing}
          </div>
        `}
      ></ui-panel-section>
    `;
  }
}
