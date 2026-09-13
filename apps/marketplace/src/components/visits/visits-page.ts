import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import { visitService } from '../../services/visit.service';
import { type User, type Visit } from '@artaround/shared';
import {
  getPermissions,
  canEditOwnItem,
  isMuseumCurator,
  type PermissionSet,
} from '../../services/permissions.service';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-badge';
import '../ui/ui-modal';
import '../ui/ui-image-placeholder';
import '../ui/ui-page-header';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-search-bar';
import '../ui/ui-filter-tabs';
import '../ui/ui-icon-button';
import '../ui/ui-media-card';
import '../ui/ui-museum-required-notice';
import './visit-editor';
import { __ } from '../../services/i18n.service';

type ViewMode = 'list' | 'create' | 'edit';

/**
 * Pagina Visite
 *
 * Mostra e gestisce le Visite (percorsi di visita).
 */
@customElement('visits-page')
export class VisitsPage extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) authorArea = false;
  @property({ type: String }) openingVisitId = '';
  @property({ type: String }) openingViewMode: ViewMode = 'list';
  @property({ type: String }) openingTab = '';

  @state() private viewMode: ViewMode = 'list';
  @state() private visits: Visit[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private searchQuery = '';
  @state() private selectedVisit: Visit | null = null;
  @state() private deleteModalOpen = false;
  @state() private visitToDelete: Visit | null = null;
  @state() private deleting = false;
  @state() private filterPublished: 'all' | 'published' | 'draft' = 'all';

  // ─── Stato calcolato ──────────────────────────────────────
  private get permissions(): PermissionSet {
    return getPermissions(this.user, this.selectedMuseumId ?? undefined);
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    this.loadVisits();
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('openingViewMode')) {
      if (this.openingViewMode === 'list') {
        this.selectedVisit = null;
        this.viewMode = 'list';
      } else if (this.openingViewMode === 'edit') {
        this.viewMode = 'edit';
      } else if (this.openingViewMode === 'create') {
        this.viewMode = 'create';
      }
    }
    if (changedProps.has('viewMode')) {
      this.scrollToTop();
      this.emitStateChange();
    }
  }

  /**
   * Stato granulare (viewMode + visita selezionata + tab dell'editor) verso
   * app-root, per la history — stesso schema di artworks-page.ts. `visitId`
   * usa openingVisitId come fallback quando si arriva da fuori (avanti/
   * indietro/deep-link): a differenza di artworks-page qui non serve un
   * fetch, visit-editor carica da sé i dati partendo dal solo id.
   *
   * `tab` è sempre presente nel detail (stringa vuota se non applicabile):
   * handlePageStateChanged in app-root fa un merge, non una sostituzione —
   * ometterlo del tutto quando si esce dall'editor lascerebbe in giro il
   * valore della tab precedente nei routeParams.
   */
  private emitStateChange(tab = '', replace = false): void {
    const isEditorOpen = this.viewMode === 'edit' || this.viewMode === 'create';
    const visitId =
      this.viewMode === 'edit' ? this.selectedVisit?._id || this.openingVisitId || '' : '';

    this.dispatchEvent(
      new CustomEvent('page-state-changed', {
        detail: { viewMode: this.viewMode, visitId, tab: isEditorOpen ? tab : '', replace },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Intercetta lo stato del tab attivo emesso da <visit-editor> (vedi il suo
  // updated()): da solo non sa "quale visita"/"in che modalità", li aggiunge
  // qui prima di farlo risalire — impedisce anche al `page-state-changed`
  // "grezzo" del figlio di bollare fino ad app-root privo di quel contesto.
  // `replace` arriva dal figlio (vero solo per la sua primissima emissione,
  // vedi visit-editor.ts) e passa così com'è.
  private handleEditorStateChanged(e: CustomEvent<{ tab?: string; replace?: boolean }>) {
    e.stopPropagation();
    this.emitStateChange(e.detail.tab, e.detail.replace);
  }

  onMuseumChanged(): void {
    this.loadVisits();
  }

  // ─── Caricamento dati / filtri ──────────────────────────────
  private async loadVisits() {
    this.loading = true;
    this.error = '';

    try {
      // Admin e curatore vedono tutte le visite, gli altri solo le proprie
      if (this.permissions.canViewAnalytics) {
        const response = await visitService.getVisits({
          museumId: this.selectedMuseumId || undefined,
        });
        this.visits = response.visits;
      } else {
        // Load user's own visits
        const visits = await visitService.getMyVisits();
        this.visits = this.selectedMuseumId
          ? visits.filter((visit) => visit.museumId === this.selectedMuseumId)
          : visits;
      }
    } catch (e) {
      console.error('Error loading visits:', e);
      this.error = __('Impossibile caricare le visite');
    } finally {
      this.loading = false;
    }
  }

  private get filteredVisits(): Visit[] {
    let filtered = this.visits;

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) => v.title.toLowerCase().includes(query) || v.description.toLowerCase().includes(query),
      );
    }

    // Filter by published status
    if (this.filterPublished === 'published') {
      filtered = filtered.filter((v) => v.isPublished);
    } else if (this.filterPublished === 'draft') {
      filtered = filtered.filter((v) => !v.isPublished);
    }

    return filtered;
  }

  // ─── Azioni lista / form ─────────────────────────────────
  private handleCreateVisit() {
    this.selectedVisit = null;
    this.viewMode = 'create';
  }

  private backToListView() {
    this.viewMode = 'list';
    this.selectedVisit = null;
  }

  /**
   * Permesso reale di modificare/eliminare QUESTA visita: proprio contenuto
   * (sempre, ovunque), oppure curatore del museo selezionato. Usa
   * this.selectedMuseumId (sempre l'_id Mongo) e non visit.museumId (salvato
   * come QID Wikidata — vedi il commento analogo in contents-page.ts): i due
   * formati non sono direttamente confrontabili senza risolverli lato server.
   */
  private canManageVisit(visit: Visit): boolean {
    if (isMuseumCurator(this.user, this.selectedMuseumId ?? undefined)) {
      return true;
    }
    return canEditOwnItem(this.user, visit.authorId);
  }

  private handleEditVisit(visit: Visit) {
    if (!this.canManageVisit(visit)) {
      this.error = __('Non hai i permessi per modificare questa visita.');
      return;
    }
    this.selectedVisit = visit;
    this.viewMode = 'edit';
  }

  private handleDeleteClick(visit: Visit) {
    if (!this.canManageVisit(visit)) {
      this.error = __('Non hai i permessi per eliminare questa visita.');
      return;
    }
    this.visitToDelete = visit;
    this.deleteModalOpen = true;
  }

  private async handleConfirmDelete() {
    if (!this.visitToDelete) return;

    this.deleting = true;
    try {
      await visitService.delete(this.visitToDelete._id);
      this.visits = this.visits.filter((v) => v._id !== this.visitToDelete!._id);
      this.deleteModalOpen = false;
      this.visitToDelete = null;
    } catch (e) {
      console.error('Error deleting visit:', e);
      this.error = e instanceof Error ? e.message : __('Impossibile eliminare la visita');
    } finally {
      this.deleting = false;
    }
  }

  // Solo la creazione torna alla lista: in modifica si resta sull'editor (mostra
  // "Visita aggiornata con successo!"), comodo per modificare più tappe in sequenza
  // su un percorso lungo senza doverlo riaprire ogni volta.
  private handleVisitSaved() {
    if (this.viewMode === 'create') {
      this.backToListView();
    }
    this.loadVisits();
  }

  private handleCancel() {
    this.backToListView();
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderVisitsList() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${this.filteredVisits.map((visit) => this.renderVisitCard(visit))}
      </div>
    `;
  }

  private renderVisitCard(visit: Visit) {
    const artworksCount =
      visit.metadata?.artworksCount || visit.steps?.filter((s) => s.type === 'artwork').length || 0;
    const duration =
      visit.targetAudience?.estimatedDuration || visit.metadata?.estimatedDuration || 0;

    return html`
      <ui-media-card
        .imageSrc=${visit.coverImage || ''}
        .imageAlt=${visit.title}
        placeholderType="museum"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          visit.isPublished
            ? html`<ui-badge variant="success" .label=${__('Pubblicata')}></ui-badge>`
            : html`<ui-badge variant="secondary" .label=${__('Bozza')}></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${visit.title}
          </h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">
            ${visit.description}
          </p>

          <div class="flex items-center gap-4 text-sm text-surface-500 dark:text-surface-400 mb-3">
            <span class="flex items-center gap-1">
              <ui-icon name="image" size="xs"></ui-icon>
              ${artworksCount} ${artworksCount === 1 ? __('opera') : __('opere')}
            </span>
            <span class="flex items-center gap-1">
              <ui-icon name="clock" size="xs"></ui-icon>
              ${duration} min
            </span>
            ${visit.metadata?.isFree
              ? html`<span class="text-success-600 dark:text-success-400">${__('Gratuita')}</span>`
              : html`<span>€${visit.metadata?.price?.toFixed(2) || '0.00'}</span>`}
          </div>

          ${visit.targetAudience?.languageLevels?.length
            ? html`
                <div class="flex flex-wrap gap-1 mb-3">
                  ${visit.targetAudience.languageLevels
                    .slice(0, 3)
                    .map(
                      (level) =>
                        html`<ui-badge variant="outline" size="sm" .label=${level}></ui-badge>`,
                    )}
                  ${visit.targetAudience.languageLevels.length > 3
                    ? html`<ui-badge
                        variant="outline"
                        size="sm"
                        .label=${`+${visit.targetAudience.languageLevels.length - 3}`}
                      ></ui-badge>`
                    : nothing}
                </div>
              `
            : nothing}

          <div
            class="flex items-center justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800"
          >
            ${this.canManageVisit(visit)
              ? html`
                  <ui-icon-button
                    icon="edit"
                    .title=${__('Modifica')}
                    @click=${() => this.handleEditVisit(visit)}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    .title=${__('Elimina')}
                    @click=${() => this.handleDeleteClick(visit)}
                  ></ui-icon-button>
                `
              : nothing}
          </div>
        `}
      ></ui-media-card>
    `;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (this.viewMode === 'create' || this.viewMode === 'edit') {
      return html`
        <visit-editor
          .visitId=${this.selectedVisit?._id || this.openingVisitId || ''}
          .openingTab=${this.openingTab}
          @visit-saved=${this.handleVisitSaved}
          @cancel=${this.handleCancel}
          @page-state-changed=${this.handleEditorStateChanged}
        ></visit-editor>
      `;
    }

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          .title=${__('Le tue Visite')}
          .description=${__('Crea e gestisci i tuoi percorsi di visita guidata')}
          .count=${this.visits.length}
          .help=${__(
            'Una visita è il percorso guidato che il visitatore segue nel Navigator: una sequenza di tappe (opere, approfondimenti, indicazioni) posizionate sulla piantina. Solo le visite Pubblicate sono visibili nel Navigator/Marketplace; le Bozze restano nascoste finché non le pubblichi.',
          )}
        >
          <div
            slot="actions"
            class="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-3"
          >
            <ui-search-bar
              class="w-full sm:w-64"
              .placeholder=${__('Cerca visite...')}
              .value=${this.searchQuery}
              .showButton=${false}
              @search=${(e: CustomEvent) => (this.searchQuery = e.detail.value)}
            ></ui-search-bar>

            ${this.permissions.canCreateVisit
              ? html`
                  <ui-button
                    variant="primary"
                    icon="plus"
                    class="w-full sm:w-auto"
                    .label=${__('Nuova Visita')}
                    @click=${this.handleCreateVisit}
                  ></ui-button>
                `
              : nothing}
          </div>
        </ui-page-header>

        <!-- Messaggio di errore -->
        ${this.error
          ? html`<ui-alert
              variant="danger"
              .message=${this.error}
              dismissible
              @dismiss=${() => (this.error = '')}
            ></ui-alert>`
          : nothing}
        ${!this.selectedMuseumId && !this.authorArea
          ? html`<ui-museum-required-notice
              subject="visite"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}

        <!-- Filters -->
        <ui-filter-tabs
          .tabs=${[
            { value: 'all', label: __('Tutte') },
            { value: 'published', label: __('Pubblicate') },
            { value: 'draft', label: __('Bozze') },
          ]}
          .value=${this.filterPublished}
          @filter-change=${(e: CustomEvent) => (this.filterPublished = e.detail.value)}
        ></ui-filter-tabs>

        <!-- Content -->
        ${this.loading
          ? html`<ui-loading size="lg" .text=${__('Caricamento visite...')}></ui-loading>`
          : this.filteredVisits.length === 0
            ? html`<ui-empty
                icon=${this.searchQuery || this.filterPublished !== 'all' ? 'search' : 'document'}
                .title=${this.searchQuery || this.filterPublished !== 'all'
                  ? __('Nessun risultato')
                  : __('Nessuna visita')}
                .description=${this.searchQuery || this.filterPublished !== 'all'
                  ? __('Prova a modificare i filtri di ricerca')
                  : __('Non hai ancora creato nessuna visita guidata')}
              >
                ${this.permissions.canCreateVisit &&
                !this.searchQuery &&
                this.filterPublished === 'all'
                  ? html`<ui-button
                      slot="action"
                      variant="primary"
                      icon="plus"
                      .label=${__('Crea la prima visita')}
                      @click=${this.handleCreateVisit}
                    ></ui-button>`
                  : nothing}
              </ui-empty>`
            : this.renderVisitsList()}
      </div>

      <!-- Delete Modal -->
      <ui-modal
        .title=${__('Elimina Visita')}
        message=${`${__('Sei sicuro di voler eliminare la visita')} "${this.visitToDelete?.title}"? ${__('Questa azione non può essere annullata.')}`}
        variant="danger"
        .confirmLabel=${__('Elimina')}
        .cancelLabel=${__('Annulla')}
        ?open=${this.deleteModalOpen}
        ?loading=${this.deleting}
        @confirm=${this.handleConfirmDelete}
        @cancel=${() => {
          this.deleteModalOpen = false;
          this.visitToDelete = null;
        }}
      ></ui-modal>
    `;
  }
}
