import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AppLanguage, Museum } from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import { renderStackedTranslations } from '../../utils/translation-panel';
import '../ui/ui-panel-section';
import '../ui/ui-select';
import '../ui/ui-input';
import '../ui/ui-textarea';
import '../ui/ui-checkbox';
import '../ui/image-editor';

/**
 * Tab "Informazioni" del visit-editor: museo, titolo/descrizione e immagine di copertina.
 */
@customElement('visit-info-tab')
export class VisitInfoTab extends LitElement {
  @property({ type: Array }) museums: Museum[] = [];
  @property({ type: String }) museumId = '';
  @property({ type: Boolean }) loadingMuseums = true;
  @property({ type: String }) visitTitle = '';
  @property({ type: String }) description = '';
  @property({ type: String }) coverImage = '';
  @property({ type: Array }) targetLanguages: AppLanguage[] = [];
  @property({ type: Object }) titleTranslations: Partial<Record<AppLanguage, string>> = {};
  @property({ type: Object }) descriptionTranslations: Partial<Record<AppLanguage, string>> = {};
  @property({ type: Boolean }) translating = false;
  @property({ type: Object }) getLanguageLabel: (language: AppLanguage) => string = String;
  @property({ type: Object }) getTranslationStatus: (language: AppLanguage) => 'ai' | 'manual' =
    () => 'manual';
  @property({ type: String }) costs = '';
  @property({ type: String }) ticketInfo = '';
  @property({ type: String }) openingHours = '';
  @property({ type: String }) accessibility = '';
  @property({ type: Boolean }) wheelchairAccessible = false;

  createRenderRoot() {
    return this;
  }

  private emitChange(detail: Record<string, unknown>) {
    this.dispatchEvent(new CustomEvent('info-change', { detail, bubbles: true, composed: true }));
  }

  private emitTranslationChange(lang: AppLanguage, field: 'title' | 'description', value: string) {
    this.dispatchEvent(
      new CustomEvent('translation-change', {
        detail: { lang, field, value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="space-y-8">
        <ui-panel-section
          .title=${__('Museo')}
          icon="location"
          .help=${__(
            'Il museo in cui si svolge la visita: determina quali opere, piante e marker sono disponibili nelle tappe del Percorso. Cambiarlo dopo aver già aggiunto delle tappe non le rimuove automaticamente, ma i riferimenti a opere/waypoint del museo precedente restano non validi.',
          )}
          .renderContent=${() => html`
            <ui-select
              .label=${__('Seleziona il museo')}
              .value=${this.museumId}
              .options=${this.museums.map((m) => ({ value: m._id, label: m.name }))}
              placeholder=${this.loadingMuseums ? __('Caricamento...') : __('Seleziona il museo')}
              ?disabled=${this.loadingMuseums}
              @select-change=${(e: CustomEvent) => this.emitChange({ museumId: e.detail.value })}
              required
            ></ui-select>
          `}
        ></ui-panel-section>
        <ui-panel-section
          .title=${__('Informazioni di base')}
          icon="document"
          .renderContent=${() => html`
            <div class="space-y-4">
              <ui-input
                .label=${__('Titolo della visita')}
                .placeholder=${__('Es. Capolavori del Rinascimento')}
                .value=${this.visitTitle}
                @input=${(e: InputEvent) =>
                  this.emitChange({ visitTitle: (e.target as HTMLInputElement).value })}
                required
              ></ui-input>

              <ui-textarea
                .label=${__('Descrizione')}
                .placeholder=${__('Descrivi il percorso di visita...')}
                .value=${this.description}
                @input=${(e: InputEvent) =>
                  this.emitChange({ description: (e.target as HTMLTextAreaElement).value })}
                rows="4"
                required
              ></ui-textarea>

              ${renderStackedTranslations({
                targetLanguages: this.targetLanguages,
                getLanguageLabel: this.getLanguageLabel,
                getTranslationStatus: this.getTranslationStatus,
                translating: this.translating,
                onTranslateMissing: () =>
                  this.dispatchEvent(
                    new CustomEvent('translate-missing', { bubbles: true, composed: true }),
                  ),
                getFields: (lang) => [
                  {
                    label: `${__('Titolo')} (${lang.toUpperCase()})`,
                    value: this.titleTranslations[lang] || '',
                    kind: 'input',
                    onUpdate: (value) => this.emitTranslationChange(lang, 'title', value),
                  },
                  {
                    label: `${__('Descrizione')} (${lang.toUpperCase()})`,
                    value: this.descriptionTranslations[lang] || '',
                    kind: 'textarea',
                    rows: 3,
                    onUpdate: (value) => this.emitTranslationChange(lang, 'description', value),
                  },
                ],
              })}

              <image-editor
                .label=${__('Immagine di copertina')}
                category="visits"
                .value=${this.coverImage}
                maxWidth=${1200}
                maxHeight=${800}
                .maxOutputSizeMb=${3}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) =>
                  this.emitChange({ coverImage: e.detail.path || '' })}
              ></image-editor>
              <p class="text-xs text-surface-500 dark:text-surface-400">
                ${__(
                  "Se non ne carichi una, nel marketplace e nelle card viene mostrata l'immagine del museo.",
                )}
              </p>
            </div>
          `}
        ></ui-panel-section>
        <ui-panel-section
          .title=${__('Informazioni pratiche')}
          icon="info"
          .help=${__(
            'Specifiche di questa visita, indipendenti da quelle generali del museo (utile per es. per una mostra temporanea con orari o biglietto propri). Lascia vuoto un campo per non mostrarlo nella scheda della visita.',
          )}
          .renderContent=${() => html`
            <div class="space-y-4">
              <ui-input
                .label=${__('Costi')}
                .placeholder=${__('Es. Ingresso €15, ridotto €8')}
                .value=${this.costs}
                @input=${(e: InputEvent) =>
                  this.emitChange({ costs: (e.target as HTMLInputElement).value })}
              ></ui-input>

              <ui-input
                .label=${__('Informazioni biglietti')}
                .placeholder=${__('Es. Prenotazione obbligatoria online')}
                .value=${this.ticketInfo}
                @input=${(e: InputEvent) =>
                  this.emitChange({ ticketInfo: (e.target as HTMLInputElement).value })}
              ></ui-input>

              <ui-input
                .label=${__('Orari di apertura')}
                .placeholder=${__('Es. Mar-Dom 9:00-19:00')}
                .value=${this.openingHours}
                @input=${(e: InputEvent) =>
                  this.emitChange({ openingHours: (e.target as HTMLInputElement).value })}
              ></ui-input>

              <ui-textarea
                .label=${__('Accessibilità')}
                .placeholder=${__('Es. Accessibile ai disabili, ascensore disponibile')}
                .value=${this.accessibility}
                @input=${(e: InputEvent) =>
                  this.emitChange({ accessibility: (e.target as HTMLTextAreaElement).value })}
                rows="2"
              ></ui-textarea>

              <ui-checkbox
                .label=${__('Accessibile in sedia a rotelle')}
                .checked=${this.wheelchairAccessible}
                @checkbox-change=${(e: CustomEvent) =>
                  this.emitChange({ wheelchairAccessible: e.detail.checked })}
              ></ui-checkbox>
            </div>
          `}
        ></ui-panel-section>
      </div>
    `;
  }
}
