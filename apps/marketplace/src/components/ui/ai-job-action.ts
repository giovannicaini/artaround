import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { modalService } from '../../services/modal.service';
import type { Job, JobType } from '../../services/jobs.service';
import { __ } from '../../services/i18n.service';
import './ui-button';
import './ui-icon';
import './ui-icon-button';

/**
 * Riga compatta per un'azione AI a lungo termine tracciata come Job (audio
 * generato, sincronizzazione traduzioni — vedi jobs.service.ts): icona,
 * etichetta, spiegazione dietro un'icona "ⓘ" invece di un paragrafo sempre
 * visibile, bottone che passa da un modale di conferma prima di emettere
 * 'start' (chi la usa fa la vera chiamata API al conferma, poi passa
 * `.loading`). Calcola da sé, da `.jobs` (l'intera lista, così il chiamante
 * non deve ricalcolare filtri ripetuti in ogni pagina):
 * - un job di questo `jobType` già attivo per QUESTA risorsa (`museumId`/
 *   `visitId`, se dati) → banner inline al posto del bottone;
 * - un job dello stesso `jobType` attivo altrove → bottone disabilitato con
 *   nota (l'esclusione reciproca è per-tipo, non per risorsa: vedi
 *   jobs.service.ts lato server).
 *
 * @fires start - L'utente ha confermato nel modale: il chiamante esegue la
 *   vera chiamata API e imposta `.loading` finché non risponde.
 */
@customElement('ai-job-action')
export class AiJobAction extends LitElement {
  @property({ type: String }) icon = 'sparkles';
  @property({ type: String }) label = '';
  @property({ type: String }) description = '';
  @property({ type: String }) confirmTitle = '';
  @property({ type: String }) confirmMessage = '';
  @property({ type: Boolean }) loading = false;
  @property({ type: Array }) jobs: Job[] = [];
  @property({ type: String }) jobType!: JobType;
  @property({ type: String }) museumId?: string;
  @property({ type: String }) visitId?: string;

  @state() private infoOpen = false;

  createRenderRoot() {
    return this;
  }

  private get activeJobForThisResource(): Job | null {
    return (
      this.jobs.find(
        (job) =>
          job.status === 'running' &&
          job.type === this.jobType &&
          (this.museumId === undefined || job.museumId === this.museumId) &&
          (this.visitId === undefined || job.visitId === this.visitId),
      ) ?? null
    );
  }

  private get activeJobElsewhere(): boolean {
    return this.jobs.some((job) => job.status === 'running' && job.type === this.jobType);
  }

  private async handleClick() {
    const confirmed = await modalService.confirm({
      title: this.confirmTitle || this.label,
      message: this.confirmMessage || this.description,
      variant: 'info',
      confirmLabel: __('Avvia'),
      cancelLabel: __('Annulla'),
    });
    if (!confirmed) return;

    this.dispatchEvent(new CustomEvent('start', { bubbles: true, composed: true }));
  }

  render() {
    const activeHere = this.activeJobForThisResource;
    const activeElsewhere = !activeHere && this.activeJobElsewhere;

    return html`
      <div class="flex items-start gap-3 py-3">
        <div
          class="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-brand-50 dark:bg-surface-800 text-brand-600 dark:text-brand-400"
        >
          <ui-icon name=${this.icon} size="sm"></ui-icon>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-medium text-surface-800 dark:text-surface-100"
              >${this.label}</span
            >
            ${this.description
              ? html`
                  <ui-icon-button
                    icon="info"
                    size="xs"
                    .title=${__('Maggiori informazioni')}
                    @click=${() => (this.infoOpen = !this.infoOpen)}
                  ></ui-icon-button>
                `
              : nothing}
          </div>
          ${this.infoOpen
            ? html`
                <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">
                  ${this.description}
                </p>
              `
            : nothing}
          ${activeElsewhere
            ? html`
                <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  ${__(
                    "Un'altra operazione dello stesso tipo è già in corso: attendi che finisca prima di avviarne un'altra (vedi notifiche).",
                  )}
                </p>
              `
            : nothing}
        </div>
        <div class="flex-shrink-0">
          ${activeHere
            ? html`
                <span
                  class="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
                  ${__('In corso')}
                </span>
              `
            : html`
                <ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  .loading=${this.loading}
                  .disabled=${activeElsewhere}
                  .label=${__('Avvia')}
                  @click=${this.handleClick}
                ></ui-button>
              `}
        </div>
      </div>
    `;
  }
}
