import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { AppLanguage } from '@artaround/shared';
import type { Job } from '../../services/jobs.service';
import { __ } from '../../services/i18n.service';
import '../ui/ui-panel-section';
import '../ui/ui-language-select';
import '../ui/ui-checkbox';
import '../ui/ui-input';
import '../ui/ui-tag-input';
import '../ui/ai-job-action';

/**
 * Tab "Impostazioni" del visit-editor: lingua, prezzo, servizi e strumenti AI.
 */
@customElement('visit-settings-tab')
export class VisitSettingsTab extends LitElement {
  @property({ type: String }) visitId = '';
  @property({ type: String }) language: AppLanguage = 'it';
  @property({ type: Array }) activeLanguages: AppLanguage[] = ['it'];
  @property({ type: Boolean }) isFree = true;
  @property({ type: Number }) price = 0;
  @property({ type: Array }) services: string[] = [];
  @property({ type: Array }) tips: string[] = [];
  @property({ type: Array }) jobs: Job[] = [];
  @property({ type: Boolean }) syncingLanguages = false;
  @property({ type: Boolean }) generatingAudio = false;

  createRenderRoot() {
    return this;
  }

  private emitChange(detail: Record<string, unknown>) {
    this.dispatchEvent(
      new CustomEvent('settings-change', { detail, bubbles: true, composed: true }),
    );
  }

  render() {
    return html`
      <div class="space-y-8">
        <ui-panel-section
          .title=${__('Lingua')}
          icon="globe"
          .renderContent=${() => html`
            <ui-language-select
              .label=${__('Lingua principale')}
              .value=${this.language}
              .languages=${this.activeLanguages}
              @select-change=${(e: CustomEvent) =>
                this.emitChange({ language: (e.detail.value || 'it') as AppLanguage })}
            ></ui-language-select>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Prezzo')}
          icon="euro"
          .renderContent=${() => html`
            <div class="space-y-4">
              <ui-checkbox
                .label=${__('Visita gratuita')}
                .checked=${this.isFree}
                @checkbox-change=${(e: CustomEvent) =>
                  this.emitChange({ isFree: e.detail.checked })}
              ></ui-checkbox>

              ${!this.isFree
                ? html`
                    <ui-input
                      type="number"
                      .label=${__('Prezzo (€)')}
                      .placeholder=${__('Es. 4.99')}
                      .value=${String(this.price)}
                      @input=${(e: InputEvent) =>
                        this.emitChange({
                          price: parseFloat((e.target as HTMLInputElement).value) || 0,
                        })}
                      step="0.01"
                      min="0"
                    ></ui-input>
                  `
                : nothing}
            </div>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Servizi disponibili')}
          icon="cog"
          .help=${__(
            'Testo libero mostrato nella scheda della visita — non collegato ai "Servizi del museo" (quelli strutturati, con marker sulla mappa) gestiti in Gestione Musei.',
          )}
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Es. Bar, Guardaroba, WiFi')}
              .tags=${this.services}
              .lowercase=${false}
              .emptyText=${__('Nessun servizio aggiunto')}
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) =>
                this.emitChange({ services: e.detail.tags })}
            ></ui-tag-input>
          `}
        ></ui-panel-section>

        <ui-panel-section
          .title=${__('Consigli per i visitatori')}
          icon="info"
          .renderContent=${() => html`
            <ui-tag-input
              .placeholder=${__('Es. Arrivare con 15 minuti di anticipo')}
              .tags=${this.tips}
              .lowercase=${false}
              .emptyText=${__('Nessun consiglio aggiunto')}
              @tags-change=${(e: CustomEvent<{ tags: string[] }>) =>
                this.emitChange({ tips: e.detail.tags })}
            ></ui-tag-input>
          `}
        ></ui-panel-section>

        ${this.visitId
          ? html`
              <ui-panel-section
                .title=${__('Strumenti AI')}
                icon="sparkles"
                .renderContent=${() => html`
                  <div class="divide-y divide-surface-100 dark:divide-surface-800">
                    <ai-job-action
                      icon="translate"
                      jobType="sync-languages"
                      .visitId=${this.visitId}
                      .jobs=${this.jobs}
                      .loading=${this.syncingLanguages}
                      .label=${__('Sincronizza traduzioni')}
                      .description=${__(
                        'Applica le lingue attive del museo al testo di questa visita e degli item che referenzia: rimuove traduzioni non richieste e genera con AI quelle mancanti.',
                      )}
                      .confirmTitle=${__('Sincronizzare le traduzioni di questa visita?')}
                      .confirmMessage=${__(
                        "Applica le lingue attive del museo al testo di questa visita e degli item che referenzia: rimuove traduzioni non richieste e genera con AI quelle mancanti. Segui l'avanzamento dalle notifiche.",
                      )}
                      @start=${() =>
                        this.dispatchEvent(
                          new CustomEvent('sync-languages', { bubbles: true, composed: true }),
                        )}
                    ></ai-job-action>
                    <ai-job-action
                      icon="sparkles"
                      jobType="generate-audio"
                      .visitId=${this.visitId}
                      .jobs=${this.jobs}
                      .loading=${this.generatingAudio}
                      .label=${__('Genera audio mancante')}
                      .description=${__(
                        "Genera con OpenAI (voce naturale + evidenziazione sincronizzata nel Navigator) l'audio mancante degli item e delle tappe Info/Indicazioni di questa visita — non rigenera l'audio già presente.",
                      )}
                      .confirmTitle=${__("Generare l'audio di questa visita?")}
                      .confirmMessage=${__(
                        "Genera con OpenAI l'audio mancante degli item e delle tappe di questa visita. Operazione a pagamento (chiama OpenAI per ogni testo): non rigenera l'audio già presente. Segui l'avanzamento dalle notifiche.",
                      )}
                      @start=${() =>
                        this.dispatchEvent(
                          new CustomEvent('generate-audio', { bubbles: true, composed: true }),
                        )}
                    ></ai-job-action>
                  </div>
                `}
              ></ui-panel-section>
            `
          : nothing}
      </div>
    `;
  }
}
