/*
 * File: /src/components/visits/visits-page.ts                                           *
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

import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { MuseumAwareMixin, AppBaseElement, DeletableMixin, HistorySyncMixin } from '../../base';
import { renderControlsSummaryBadge } from '../../utils/list-controls';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';
import { visitService } from '../../services/visit.service';
import { type User, type Visit, type LanguageLevel } from '@artaround/shared';
import {
  getPermissions,
  canEditOwnItem,
  isMuseumCurator,
  type PermissionSet,
} from '../../services/permissions.service';
import { getLocalizedText } from '../../utils/localized-text';
import { getLanguageLevelOptions } from '../../utils/enum-labels';
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
import '../ui/ui-select';
import '../ui/ui-list-controls';
import '../ui/ui-icon-button';
import '../ui/ui-media-card';
import '../ui/ui-museum-required-notice';
import './visit-editor';
import { __ } from '../../services/i18n.service';

type ViewMode = 'list' | 'create' | 'edit';

/**
 * Pagina Visite: catalogo, filtri e form di creazione/modifica di una visita.
 */
@customElement('visits-page')
export class VisitsPage extends DeletableMixin(HistorySyncMixin(MuseumAwareMixin(AppBaseElement))) {
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
  @state() private filterPublished: 'all' | 'published' | 'draft' = 'all';
  @state() private filterLanguageLevel: LanguageLevel | '' = '';
  @state() private filterIsFree: 'true' | 'false' | '' = '';
  @state() private controlsCollapsed = true;

  // Filtri collassati di default, ma tutti locali: nessuna ricarica dal server, niente bottone "Applica".
  private get activeFilterCount(): number {
    return [
      this.searchQuery.trim(),
      this.filterPublished !== 'all' ? '1' : '',
      this.filterLanguageLevel,
      this.filterIsFree,
    ].filter(Boolean).length;
  }

  private get languageLevelFilterOptions() {
    return getLanguageLevelOptions();
  }

  private handleResetFilters() {
    this.searchQuery = '';
    this.filterPublished = 'all';
    this.filterLanguageLevel = '';
    this.filterIsFree = '';
  }

  private renderControlsContent() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ui-input
          .label=${__('Ricerca')}
          .placeholder=${__('Cerca visite...')}
          .value=${this.searchQuery}
          @input-change=${(e: CustomEvent<{ value: string }>) => {
            this.searchQuery = e.detail.value;
          }}
        ></ui-input>

        <ui-select
          .label=${__('Stato')}
          .value=${this.filterPublished}
          .options=${[
            { value: 'all', label: __('Tutte') },
            { value: 'published', label: __('Pubblicate') },
            { value: 'draft', label: __('Bozze') },
          ]}
          @select-change=${(e: CustomEvent<{ value: 'all' | 'published' | 'draft' }>) => {
            this.filterPublished = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Livello linguistico')}
          .placeholder=${__('Tutti i livelli')}
          clearable
          .value=${this.filterLanguageLevel}
          .options=${this.languageLevelFilterOptions}
          @select-change=${(e: CustomEvent<{ value: LanguageLevel | '' }>) => {
            this.filterLanguageLevel = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Prezzo')}
          .placeholder=${__('Gratuite e a pagamento')}
          clearable
          .value=${this.filterIsFree}
          .options=${[
            { value: 'true', label: __('Solo gratuite') },
            { value: 'false', label: __('Solo a pagamento') },
          ]}
          @select-change=${(e: CustomEvent<{ value: 'true' | 'false' | '' }>) => {
            this.filterIsFree = e.detail.value;
          }}
        ></ui-select>
      </div>

      <div class="flex items-center gap-2">
        <ui-button
          variant="secondary"
          size="sm"
          .label=${__('Reset')}
          @click=${() => this.handleResetFilters()}
        ></ui-button>
      </div>
    `;
  }

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

  // Stato granulare (viewMode + visita selezionata + tab editor) verso app-root, per la history — stesso schema di artworks-page.ts.
  private emitStateChange(tab = '', replace = false): void {
    const isEditorOpen = this.viewMode === 'edit' || this.viewMode === 'create';
    const visitId =
      this.viewMode === 'edit' ? this.selectedVisit?._id || this.openingVisitId || '' : '';
    this.emitPageStateChange({
      viewMode: this.viewMode,
      visitId,
      tab: isEditorOpen ? tab : '',
      replace,
    });
  }

  // Intercetta lo stato del tab da <visit-editor>: da solo non sa "quale visita",
  // lo aggiunge qui prima di farlo risalire ad app-root.
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

    if (this.filterLanguageLevel) {
      filtered = filtered.filter((v) =>
        v.targetAudience?.languageLevels?.includes(this.filterLanguageLevel as LanguageLevel),
      );
    }

    if (this.filterIsFree) {
      const isFree = this.filterIsFree === 'true';
      filtered = filtered.filter((v) => Boolean(v.metadata?.isFree) === isFree);
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

  // Permesso reale di modificare/eliminare QUESTA visita: proprio contenuto, oppure curatore del museo selezionato (this.selectedMuseumId, non visit.museumId).
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
    this.openDeleteModal(visit);
  }

  private async handleConfirmDelete() {
    const visit = this.entityToDelete as Visit | null;
    if (!visit) return;

    this.deleting = true;
    try {
      await visitService.delete(visit._id);
      this.visits = this.visits.filter((v) => v._id !== visit._id);
      this.closeDeleteModal();
    } catch (e) {
      console.error('Error deleting visit:', e);
      this.error = e instanceof Error ? e.message : __('Impossibile eliminare la visita');
    } finally {
      this.deleting = false;
    }
  }

  // Solo la creazione torna alla lista: in modifica si resta sull'editor per modificare più tappe di fila.
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
    const title = getLocalizedText(visit.title, visit.titleTranslations);
    const description = getLocalizedText(visit.description, visit.descriptionTranslations);

    return html`
      <ui-media-card
        .imageSrc=${visit.coverImage || ''}
        .imageAlt=${title}
        placeholderType="museum"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          visit.isPublished
            ? html`<ui-badge variant="success" .label=${__('Pubblicata')}></ui-badge>`
            : html`<ui-badge variant="secondary" .label=${__('Bozza')}></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">${title}</h3>
          <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 mb-3">
            ${description}
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
        <ui-page-header
          .title=${this.authorArea ? __('Le mie visite') : __('Visite del museo')}
          .description=${__('Crea e gestisci i tuoi percorsi di visita guidata')}
          .count=${this.visits.length}
          .help=${__(
            'Una visita è il percorso guidato che il visitatore segue nel Navigator: una sequenza di tappe (opere, approfondimenti, indicazioni) posizionate sulla piantina. Solo le visite Pubblicate sono visibili nel Navigator/Marketplace; le Bozze restano nascoste finché non le pubblichi.',
          )}
        >
          <div slot="actions" class="flex items-center gap-3">
            ${this.permissions.canCreateVisit
              ? html`
                  <ui-button
                    variant="primary"
                    icon="plus"
                    .label=${__('Nuova Visita')}
                    @click=${this.handleCreateVisit}
                  ></ui-button>
                `
              : nothing}
          </div>
        </ui-page-header>
        ${renderFeedbackAlerts({
          error: this.error,
          dismissible: true,
          onDismissError: () => (this.error = ''),
        })}
        ${!this.selectedMuseumId && !this.authorArea
          ? html`<ui-museum-required-notice
              subject="visite"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}
        <ui-list-controls
          .title=${__('Filtri e ricerca')}
          .description=${__('Espandi per filtrare per stato e ricercare per testo')}
          .collapsed=${this.controlsCollapsed}
          .renderSummary=${() => renderControlsSummaryBadge(this.activeFilterCount)}
          .renderContent=${() => this.renderControlsContent()}
          @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
            (this.controlsCollapsed = e.detail.collapsed)}
        ></ui-list-controls>
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
      <ui-modal
        .title=${__('Elimina Visita')}
        message=${`${__('Sei sicuro di voler eliminare la visita')} "${(this.entityToDelete as Visit | null)?.title}"? ${__('Questa azione non può essere annullata.')}`}
        variant="danger"
        .confirmLabel=${__('Elimina')}
        .cancelLabel=${__('Annulla')}
        ?open=${this.deleteModalOpen}
        ?loading=${this.deleting}
        @confirm=${this.handleConfirmDelete}
        @cancel=${() => this.closeDeleteModal()}
      ></ui-modal>
    `;
  }
}
