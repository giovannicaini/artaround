import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import { visitService } from '../../services/visit.service';
import type { User, Visit } from '@artaround/shared';
import { getPermissions, type PermissionSet } from '../../services/permissions.service';
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
import './visit-editor';

type ViewMode = 'list' | 'create' | 'edit';

/**
 * Visits Page
 *
 * Displays and manages Visits (percorsi di visita).
 */
@customElement('visits-page')
export class VisitsPage extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: Object }) user: User | null = null;

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
  @state() private publishing = false;

  private get permissions(): PermissionSet {
    return getPermissions(this.user);
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadVisits();
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('viewMode')) {
      this.scrollToTop();
    }
  }

  onMuseumChanged(): void {
    this.loadVisits();
  }

  private async loadVisits() {
    this.loading = true;
    this.error = '';

    try {
      // Admin and curator can see all visits, others see only their own
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
      this.error = 'Impossibile caricare le visite';
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

  private handleCreateVisit() {
    this.selectedVisit = null;
    this.viewMode = 'create';
  }

  private handleEditVisit(visit: Visit) {
    this.selectedVisit = visit;
    this.viewMode = 'edit';
  }

  private handleDeleteClick(visit: Visit) {
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
      this.error = e instanceof Error ? e.message : 'Impossibile eliminare la visita';
    } finally {
      this.deleting = false;
    }
  }

  private async handleTogglePublish(visit: Visit) {
    this.publishing = true;
    try {
      let updated: Visit;
      if (visit.isPublished) {
        updated = await visitService.unpublish(visit._id);
      } else {
        updated = await visitService.publish(visit._id);
      }
      this.visits = this.visits.map((v) => (v._id === updated._id ? updated : v));
    } catch (e) {
      console.error('Error toggling publish:', e);
      this.error =
        e instanceof Error ? e.message : 'Impossibile modificare lo stato di pubblicazione';
    } finally {
      this.publishing = false;
    }
  }

  private handleVisitSaved() {
    this.viewMode = 'list';
    this.selectedVisit = null;
    this.loadVisits();
  }

  private handleCancel() {
    this.viewMode = 'list';
    this.selectedVisit = null;
  }

  render() {
    if (this.viewMode === 'create' || this.viewMode === 'edit') {
      return html`
        <visit-editor
          .visitId=${this.selectedVisit?._id || ''}
          @visit-saved=${this.handleVisitSaved}
          @cancel=${this.handleCancel}
        ></visit-editor>
      `;
    }

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          title="Le tue Visite"
          description="Crea e gestisci i tuoi percorsi di visita guidata"
          .count=${this.visits.length}
        >
          <div slot="actions" class="flex items-center gap-3">
            <ui-search-bar
              placeholder="Cerca visite..."
              .value=${this.searchQuery}
              .showButton=${false}
              @search=${(e: CustomEvent) => (this.searchQuery = e.detail.value)}
            ></ui-search-bar>

            ${this.permissions.canCreateVisit
              ? html`
                  <ui-button
                    variant="primary"
                    icon="plus"
                    label="Nuova Visita"
                    @click=${this.handleCreateVisit}
                  ></ui-button>
                `
              : nothing}
          </div>
        </ui-page-header>

        <!-- Error Message -->
        ${this.error
          ? html`<ui-alert
              variant="danger"
              .message=${this.error}
              dismissible
              @dismiss=${() => (this.error = '')}
            ></ui-alert>`
          : nothing}
        ${!this.selectedMuseumId
          ? html`
              <ui-alert
                variant="warning"
                title="Museo non selezionato"
                message="Seleziona un museo per lavorare sulle visite."
              ></ui-alert>
              <div class="flex justify-end">
                <ui-button
                  variant="secondary"
                  size="sm"
                  label="Seleziona museo"
                  @click=${this.emitSelectMuseum}
                ></ui-button>
              </div>
            `
          : ''}

        <!-- Filters -->
        <ui-filter-tabs
          .tabs=${[
            { value: 'all', label: 'Tutte' },
            { value: 'published', label: 'Pubblicate' },
            { value: 'draft', label: 'Bozze' },
          ]}
          .value=${this.filterPublished}
          @filter-change=${(e: CustomEvent) => (this.filterPublished = e.detail.value)}
        ></ui-filter-tabs>

        <!-- Content -->
        ${this.loading
          ? html`<ui-loading size="lg" text="Caricamento visite..."></ui-loading>`
          : this.filteredVisits.length === 0
            ? html`<ui-empty
                icon=${this.searchQuery || this.filterPublished !== 'all' ? 'search' : 'document'}
                title=${this.searchQuery || this.filterPublished !== 'all'
                  ? 'Nessun risultato'
                  : 'Nessuna visita'}
                .description=${this.searchQuery || this.filterPublished !== 'all'
                  ? 'Prova a modificare i filtri di ricerca'
                  : 'Non hai ancora creato nessuna visita guidata'}
              >
                ${this.permissions.canCreateVisit &&
                !this.searchQuery &&
                this.filterPublished === 'all'
                  ? html`<ui-button
                      slot="action"
                      variant="primary"
                      icon="plus"
                      label="Crea la prima visita"
                      @click=${this.handleCreateVisit}
                    ></ui-button>`
                  : nothing}
              </ui-empty>`
            : this.renderVisitsList()}
      </div>

      <!-- Delete Modal -->
      <ui-modal
        title="Elimina Visita"
        message=${`Sei sicuro di voler eliminare la visita "${this.visitToDelete?.title}"? Questa azione non può essere annullata.`}
        variant="danger"
        confirmLabel="Elimina"
        cancelLabel="Annulla"
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
      <ui-card padding="none" hover>
        <!-- Image -->
        <div
          class="aspect-video bg-surface-100 dark:bg-surface-800 relative overflow-hidden rounded-t-xl"
        >
          ${visit.coverImage
            ? html`
                <img
                  src="${visit.coverImage}"
                  alt="${visit.title}"
                  class="w-full h-full object-cover"
                  @error=${(e: Event) => {
                    const img = e.target as HTMLImageElement;
                    img.style.display = 'none';
                    img.parentElement
                      ?.querySelector('ui-image-placeholder')
                      ?.removeAttribute('hidden');
                  }}
                />
                <ui-image-placeholder
                  type="museum"
                  size="md"
                  hidden
                  class="absolute inset-0"
                ></ui-image-placeholder>
              `
            : html` <ui-image-placeholder type="museum" size="md"></ui-image-placeholder> `}

          <!-- Status Badge -->
          <div class="absolute top-3 right-3">
            ${visit.isPublished
              ? html`<ui-badge variant="success" label="Pubblicata"></ui-badge>`
              : html`<ui-badge variant="secondary" label="Bozza"></ui-badge>`}
          </div>
        </div>

        <!-- Content -->
        <div class="p-4">
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${visit.title}
          </h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">
            ${visit.description}
          </p>

          <!-- Stats -->
          <div class="flex items-center gap-4 text-sm text-surface-500 dark:text-surface-400 mb-3">
            <span class="flex items-center gap-1">
              <ui-icon name="image" size="xs"></ui-icon>
              ${artworksCount} ${artworksCount === 1 ? 'opera' : 'opere'}
            </span>
            <span class="flex items-center gap-1">
              <ui-icon name="clock" size="xs"></ui-icon>
              ${duration} min
            </span>
            ${visit.metadata?.isFree
              ? html`<span class="text-success-600 dark:text-success-400">Gratuita</span>`
              : html`<span>€${visit.metadata?.price?.toFixed(2) || '0.00'}</span>`}
          </div>

          <!-- Language Levels -->
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

          <!-- Actions -->
          <div
            class="flex items-center justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800"
          >
            ${this.permissions.canEditVisit
              ? html`
                  <ui-icon-button
                    icon=${visit.isPublished ? 'eye-off' : 'eye'}
                    title=${visit.isPublished ? 'Rimuovi pubblicazione' : 'Pubblica'}
                    ?disabled=${this.publishing}
                    @click=${() => this.handleTogglePublish(visit)}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="edit"
                    title="Modifica"
                    @click=${() => this.handleEditVisit(visit)}
                  ></ui-icon-button>
                `
              : nothing}
            ${this.permissions.canDeleteVisit
              ? html`
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    title="Elimina"
                    @click=${() => this.handleDeleteClick(visit)}
                  ></ui-icon-button>
                `
              : nothing}
          </div>
        </div>
      </ui-card>
    `;
  }
}
