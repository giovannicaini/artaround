import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { AppBaseElement, MuseumAwareMixin, DeletableMixin, HistorySyncMixin } from '../../base';
import { itemService } from '../../services/item.service';
import {
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  type Item,
  type User,
} from '@artaround/shared';
import {
  getPermissions,
  canEditOwnItem,
  isMuseumCurator,
  type PermissionSet,
} from '../../services/permissions.service';
import {
  getContentDurationLabel,
  getLanguageLevelLabel,
  getReferenceTypeLabel,
  getContentDurationOptions,
  getReferenceTypeOptions,
  getLanguageLevelOptions,
} from '../../utils/enum-labels';
import { getLocalizedText } from '../../utils/localized-text';
import { playItemAudio, stopItemAudio } from '../../utils/audio-playback';
import { renderControlsSummaryBadge } from '../../utils/list-controls';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';
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
import '../ui/ui-pagination';
import '../ui/ui-icon-button';
import '../ui/ui-data-grid';
import '../ui/ui-media-card';
import '../ui/ui-museum-required-notice';
import '../ui/ui-panel-section';
import '../ui/ui-select';
import '../ui/ui-list-controls';
import '../items/item-creator';
import { __ } from '../../services/i18n.service';

type ViewMode = 'list' | 'create' | 'edit' | 'view';
/**
 * Pagina Contenuti: catalogo, filtri e form di creazione/modifica di un item.
 */
@customElement('contents-page')
export class ContentsPage extends DeletableMixin(
  HistorySyncMixin(MuseumAwareMixin(AppBaseElement)),
) {
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) authorOnly = false;
  @property({ type: String }) openingItemId = '';
  @property({ type: String }) openingViewMode: ViewMode = 'list';
  // Da "Vedi contenuti" in Gestione Opere: apre già filtrato su quest'opera.
  @property({ type: String }) openingArtworkId = '';

  @state() private viewMode: ViewMode = 'list';
  @state() private items: Item[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private searchQuery = '';
  @state() private pagination = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };
  @state() private selectedItem: Item | null = null;
  @state() private ownItemsCache: Item[] = [];
  @state() private playingItemId: string | null = null;

  disconnectedCallback() {
    stopItemAudio();
    super.disconnectedCallback();
  }

  // Audio caricato/generato se c'è, altrimenti sintesi vocale del browser —
  // un solo item alla volta (playItemAudio ferma da sé quello precedente).
  private togglePlayback(item: Item, text: string) {
    if (this.playingItemId === item._id) {
      stopItemAudio();
      this.playingItemId = null;
      return;
    }

    this.playingItemId = item._id;
    playItemAudio(item.audio, item.sourceLanguage, text, () => {
      if (this.playingItemId === item._id) this.playingItemId = null;
    });
  }

  // Filtri (stesso pattern collassabile usato in artworks-page.ts)
  @state() private controlsCollapsed = true;
  @state() private filterReferenceType: ItemReferenceType | '' = '';
  @state() private filterReferenceId = ''; // valorizzato solo da openingArtworkId
  @state() private filterDuration: ContentDuration | '' = '';
  @state() private filterLanguageLevel: LanguageLevel | '' = '';
  @state() private filterIsFree: 'true' | 'false' | '' = '';

  // ─── Stato calcolato ──────────────────────────────────────
  private get permissions(): PermissionSet {
    return getPermissions(this.user, this.selectedMuseumId ?? undefined);
  }

  private get activeFilterCount(): number {
    return [
      this.filterReferenceType,
      this.filterDuration,
      this.filterLanguageLevel,
      this.filterIsFree,
    ].filter(Boolean).length;
  }

  private get referenceTypeFilterOptions() {
    return getReferenceTypeOptions();
  }

  private get durationFilterOptions() {
    return getContentDurationOptions();
  }

  private get languageLevelFilterOptions() {
    return getLanguageLevelOptions();
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    this.loadItems();
  }

  updated(changedProps: Map<string, unknown>) {
    // Solo il caricamento dati: viewMode lo decide il blocco sotto, non il fetch.
    if (changedProps.has('openingItemId') && this.openingItemId) {
      void this.loadSelectedItem(this.openingItemId);
    }
    if (changedProps.has('openingArtworkId') && this.openingArtworkId) {
      this.filterReferenceType = ItemReferenceType.ARTWORK;
      this.filterReferenceId = this.openingArtworkId;
      this.controlsCollapsed = false;
      this.loadItems();
    }
    if (changedProps.has('openingViewMode')) {
      if (this.openingViewMode === 'list') {
        this.selectedItem = null;
        this.viewMode = 'list';
      } else if (this.openingViewMode === 'view') {
        this.viewMode = 'view';
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

  private async loadSelectedItem(itemId: string) {
    if (!itemId) return;
    try {
      const item = await itemService.getItem(itemId);
      if (!item) return;
      this.selectedItem = item;
    } catch (e) {
      console.error('Error loading item detail:', e);
    }
  }

  // Stato granulare (viewMode + item selezionato) verso app-root, per la history
  private emitStateChange(): void {
    const hasItemContext = this.viewMode === 'view' || this.viewMode === 'edit';
    const itemId = hasItemContext ? this.selectedItem?._id || this.openingItemId || '' : '';
    this.emitPageStateChange({ viewMode: this.viewMode, itemId });
  }

  onMuseumChanged(): void {
    this.pagination.page = 1;
    this.loadItems();
  }

  // ─── Caricamento dati ────────────────────────────────────────
  // Applica i filtri attivi (tipo riferimento, durata, livello, gratuito/a pagamento) + ricerca testuale a un array di item in…
  private applyFiltersInMemory(items: Item[]): Item[] {
    const query = this.searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (this.filterReferenceType && item.referenceType !== this.filterReferenceType) {
        return false;
      }
      if (this.filterReferenceId && item.referenceId !== this.filterReferenceId) {
        return false;
      }
      if (this.filterDuration && item.duration !== this.filterDuration) {
        return false;
      }
      if (this.filterLanguageLevel && item.languageLevel !== this.filterLanguageLevel) {
        return false;
      }
      if (this.filterIsFree && item.isFree !== (this.filterIsFree === 'true')) {
        return false;
      }
      if (query) {
        return item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query);
      }
      return true;
    });
  }

  private async loadItems() {
    this.loading = true;
    this.error = '';

    try {
      if (this.authorOnly) {
        const myItems = await itemService.getMyItems();
        const filteredByMuseum = this.selectedMuseumId
          ? myItems.filter((item) => item.museumId === this.selectedMuseumId)
          : myItems;

        this.ownItemsCache = filteredByMuseum;
        const visibleItems = this.applyFiltersInMemory(filteredByMuseum);

        this.items = visibleItems;
        this.pagination = {
          page: 1,
          limit: Math.max(visibleItems.length, 1),
          total: visibleItems.length,
          totalPages: 1,
        };
        return;
      }

      const result = await itemService.getItems({
        page: this.pagination.page,
        limit: this.pagination.limit,
        museumId: this.selectedMuseumId || undefined,
        referenceType: this.filterReferenceType || undefined,
        referenceId: this.filterReferenceId || undefined,
        duration: this.filterDuration || undefined,
        languageLevel: this.filterLanguageLevel || undefined,
        isFree: this.filterIsFree ? this.filterIsFree === 'true' : undefined,
        search: this.searchQuery.trim() || undefined,
      });
      this.items = result.items;
      this.pagination = result.pagination;
    } catch (e) {
      console.error('Error loading items:', e);
      this.error = __('Errore durante il caricamento dei contenuti');
    } finally {
      this.loading = false;
    }
  }

  // In modalità authorOnly non c'è bisogno di ricontattare il server: gli item dell'autore sono già tutti in ownItemsCache, si…
  private applyFilters() {
    this.pagination.page = 1;

    if (this.authorOnly) {
      const visibleItems = this.applyFiltersInMemory(this.ownItemsCache);
      this.items = visibleItems;
      this.pagination = {
        page: 1,
        limit: Math.max(visibleItems.length, 1),
        total: visibleItems.length,
        totalPages: 1,
      };
      return;
    }

    this.loadItems();
  }

  private handleResetFilters() {
    this.searchQuery = '';
    this.filterReferenceType = '';
    this.filterReferenceId = '';
    this.filterDuration = '';
    this.filterLanguageLevel = '';
    this.filterIsFree = '';
    this.applyFilters();
  }

  // ─── Azioni lista / form ─────────────────────────────────
  private handleViewItem(item: Item) {
    this.selectedItem = item;
    this.viewMode = 'view';
  }

  // Permesso reale di modificare/eliminare QUESTO item: proprio contenuto (sempre, ovunque), oppure curatore del museo selezionato.
  private canManageItem(item: Item): boolean {
    if (isMuseumCurator(this.user, this.selectedMuseumId ?? undefined)) {
      return true;
    }
    return canEditOwnItem(this.user, item.authorId);
  }

  private handleEditItem(item: Item) {
    if (!this.canManageItem(item)) {
      this.error = __('Non hai i permessi per modificare questo contenuto.');
      return;
    }
    this.selectedItem = item;
    this.viewMode = 'edit';
  }

  private handleDeleteItem(item: Item) {
    if (!this.canManageItem(item)) {
      this.error = __('Non hai i permessi per eliminare questo contenuto.');
      return;
    }
    this.openDeleteModal(item);
  }

  private async handleConfirmDelete() {
    const item = this.entityToDelete as Item | null;
    if (!item) return;

    this.deleting = true;
    try {
      await itemService.deleteItem(item._id);
      this.closeDeleteModal();
      this.loadItems();
    } catch (e) {
      console.error('Error deleting item:', e);
    } finally {
      this.deleting = false;
    }
  }

  private handlePageChange(page: number) {
    if (this.authorOnly) return;
    this.pagination.page = page;
    this.loadItems();
  }

  private backToListView() {
    this.viewMode = 'list';
    this.selectedItem = null;
  }

  // ─── Helper di render ──────────────────────────────────────
  private renderSelectedItemImage() {
    const item = this.selectedItem;
    if (!item) return nothing;

    return html`
      <div class="aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden">
        ${item.image
          ? html`
              <img
                src="${item.image}"
                alt="${item.title}"
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
                type="content"
                size="full"
                hidden
                class="absolute inset-0"
              ></ui-image-placeholder>
            `
          : html`<ui-image-placeholder type="content" size="full"></ui-image-placeholder>`}
      </div>
    `;
  }

  private renderDetailRow(label: string, value: unknown) {
    if (value === undefined || value === null || value === '') return nothing;

    return html`
      <div>
        <dt class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider">
          ${label}
        </dt>
        <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">${value}</dd>
      </div>
    `;
  }

  private renderControlsContent() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ui-input
          .label=${__('Ricerca')}
          .placeholder=${__('Cerca contenuti...')}
          .value=${this.searchQuery}
          @input-change=${(e: CustomEvent<{ value: string }>) => {
            this.searchQuery = e.detail.value;
          }}
        ></ui-input>

        <ui-select
          .label=${__('Tipo di riferimento')}
          .placeholder=${__('Tutti i tipi')}
          clearable
          .value=${this.filterReferenceType}
          .options=${this.referenceTypeFilterOptions}
          @select-change=${(e: CustomEvent<{ value: ItemReferenceType | '' }>) => {
            this.filterReferenceType = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Durata')}
          .placeholder=${__('Tutte le durate')}
          clearable
          .value=${this.filterDuration}
          .options=${this.durationFilterOptions}
          @select-change=${(e: CustomEvent<{ value: ContentDuration | '' }>) => {
            this.filterDuration = e.detail.value;
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
          .placeholder=${__('Gratuiti e a pagamento')}
          clearable
          .value=${this.filterIsFree}
          .options=${[
            { value: 'true', label: __('Solo gratuiti') },
            { value: 'false', label: __('Solo a pagamento') },
          ]}
          @select-change=${(e: CustomEvent<{ value: 'true' | 'false' | '' }>) => {
            this.filterIsFree = e.detail.value;
          }}
        ></ui-select>
      </div>

      <div class="flex items-center gap-2">
        <ui-button
          variant="primary"
          size="sm"
          icon="search"
          .label=${__('Applica filtri')}
          @click=${() => this.applyFilters()}
        ></ui-button>
        <ui-button
          variant="secondary"
          size="sm"
          .label=${__('Reset')}
          @click=${() => this.handleResetFilters()}
        ></ui-button>
      </div>
    `;
  }

  private renderListView() {
    return html`
      <div class="space-y-6">
        <ui-page-header
          .title=${this.authorOnly ? __('I miei contenuti') : __('Contenuti del museo')}
          .count=${this.pagination.total}
          .countLabel=${__('contenuti totali')}
          .description=${__('Testi descrittivi per opere, autori, movimenti')}
          .help=${__(
            'Un "contenuto" è un testo (con audio) letto dal Navigator durante la visita: può parlare di un\'opera specifica, di un autore, di un movimento artistico o del museo in generale — non è legato a una singola visita, ma può essere richiamato da più visite.',
          )}
        >
          <div slot="actions" class="flex items-center gap-3">
            ${this.permissions.canCreateItem
              ? html`
                  <ui-button
                    variant="primary"
                    icon="plus"
                    .label=${__('Nuovo Contenuto')}
                    @click=${() => (this.viewMode = 'create')}
                  ></ui-button>
                `
              : nothing}
          </div>
        </ui-page-header>

        ${!this.selectedMuseumId && !this.authorOnly
          ? html`<ui-museum-required-notice
              subject="contenuti"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}
        <ui-list-controls
          .title=${__('Filtri e ricerca')}
          .description=${__('Espandi per filtrare per tipo, durata, livello e ricercare per testo')}
          .collapsed=${this.controlsCollapsed}
          .renderSummary=${() => renderControlsSummaryBadge(this.activeFilterCount)}
          .renderContent=${() => this.renderControlsContent()}
          @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
            (this.controlsCollapsed = e.detail.collapsed)}
        ></ui-list-controls>
        ${this.loading
          ? html`<ui-loading .text=${__('Caricamento contenuti...')}></ui-loading>`
          : this.error
            ? renderFeedbackAlerts({
                error: this.error,
                showRetry: true,
                onRetry: () => this.loadItems(),
              })
            : this.items.length === 0
              ? this.renderEmpty()
              : this.renderGrid()}
        <ui-pagination
          .page=${this.pagination.page}
          .totalPages=${this.pagination.totalPages}
          @page-change=${(e: CustomEvent) => this.handlePageChange(e.detail.page)}
        ></ui-pagination>
      </div>
    `;
  }

  private renderCreateView() {
    return html`
      <div class="space-y-6">
        <ui-page-header
          .title=${__('Nuovo Contenuto')}
          .description=${__('Crea un nuovo contenuto descrittivo')}
          showBack
          @back=${this.backToListView}
        ></ui-page-header>
        <item-creator
          @item-created=${() => {
            this.backToListView();
            this.loadItems();
          }}
          @cancel=${this.backToListView}
        ></item-creator>
      </div>
    `;
  }

  private renderEmpty() {
    return html`
      <ui-empty
        icon="document"
        .title=${__('Nessun contenuto')}
        .description=${this.searchQuery
          ? __('Nessun risultato per la ricerca')
          : __('Non ci sono ancora contenuti')}
      >
        ${this.permissions.canCreateItem
          ? html`
              <ui-button
                slot="action"
                variant="primary"
                icon="plus"
                .label=${__('Crea il primo contenuto')}
                @click=${() => (this.viewMode = 'create')}
              ></ui-button>
            `
          : nothing}
      </ui-empty>
    `;
  }

  private renderGrid() {
    return html`
      <ui-data-grid
        .items=${this.items}
        .columns=${3}
        .renderItem=${(item: Item) => this.renderItemCard(item)}
      ></ui-data-grid>
    `;
  }

  private renderItemCard(item: Item) {
    const title = getLocalizedText(item.title, item.translatedTitles);
    const text = getLocalizedText(item.text, item.translatedTexts);

    return html`
      <ui-media-card
        .imageSrc=${item.image || ''}
        .imageAlt=${title}
        placeholderType="content"
        placeholderSize="md"
        aspectClass="aspect-video"
        bodyClass="p-4"
        .renderTopRight=${() =>
          item.isFree
            ? html`<ui-badge variant="success" size="sm" .label=${__('Gratuito')}></ui-badge>`
            : html`<ui-badge
                variant="warning"
                size="sm"
                .label=${`€${item.price || 0}`}
              ></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">${title}</h3>

          ${item.referenceTitle
            ? html`
                <p
                  class="text-sm text-surface-500 dark:text-surface-400 mb-2 flex items-center gap-1"
                >
                  <ui-icon name="link" size="xs"></ui-icon>
                  ${item.referenceTitle}
                </p>
              `
            : nothing}

          <div class="flex flex-wrap gap-1 mb-3">
            <ui-badge
              variant="primary"
              size="sm"
              .label=${getReferenceTypeLabel(item.referenceType)}
            ></ui-badge>
            <ui-badge
              variant="secondary"
              size="sm"
              .label=${getContentDurationLabel(item.duration)}
            ></ui-badge>
            <ui-badge
              variant="secondary"
              size="sm"
              .label=${getLanguageLevelLabel(item.languageLevel)}
            ></ui-badge>
          </div>

          <p class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-3">${text}</p>

          ${item.tags && item.tags.length > 0
            ? html`
                <div class="flex flex-wrap gap-1 mb-3">
                  ${item.tags
                    .slice(0, 3)
                    .map(
                      (tag) => html`
                        <ui-badge variant="secondary" size="sm" .label=${tag}></ui-badge>
                      `,
                    )}
                  ${item.tags.length > 3
                    ? html`
                        <ui-badge
                          variant="secondary"
                          size="sm"
                          .label=${`+${item.tags.length - 3}`}
                        ></ui-badge>
                      `
                    : nothing}
                </div>
              `
            : nothing}

          <div
            class="flex items-center justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800"
          >
            <ui-icon-button
              icon=${this.playingItemId === item._id ? 'pause' : 'play'}
              .title=${this.playingItemId === item._id ? __('Interrompi') : __('Ascolta')}
              @click=${() => this.togglePlayback(item, text)}
            ></ui-icon-button>
            <ui-icon-button
              icon="eye"
              .title=${__('Visualizza')}
              @click=${() => this.handleViewItem(item)}
            ></ui-icon-button>
            ${this.canManageItem(item)
              ? html`
                  <ui-icon-button
                    icon="edit"
                    .title=${__('Modifica')}
                    @click=${() => this.handleEditItem(item)}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    .title=${__('Elimina')}
                    @click=${() => this.handleDeleteItem(item)}
                  ></ui-icon-button>
                `
              : nothing}
          </div>
        `}
      ></ui-media-card>
    `;
  }

  private renderViewMode() {
    if (!this.selectedItem) return this.renderListView();
    // Costante locale: <ui-panel-section> invoca .renderContent in un render
    // separato, se selectedItem torna null nel frattempo le chiusure leggerebbero null.
    const item = this.selectedItem;
    const title = getLocalizedText(item.title, item.translatedTitles);
    const text = getLocalizedText(item.text, item.translatedTexts);

    return html`
      <div class="space-y-6">
        <ui-page-header
          title=${title}
          .description=${item.referenceTitle || __('Contenuto')}
          showBack
          @back=${this.backToListView}
        >
          ${this.canManageItem(item)
            ? html`
                <ui-button
                  slot="actions"
                  variant="primary"
                  icon="edit"
                  .label=${__('Modifica')}
                  @click=${() => (this.viewMode = 'edit')}
                ></ui-button>
              `
            : nothing}
        </ui-page-header>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-1">
            <ui-card>${this.renderSelectedItemImage()}</ui-card>
          </div>
          <div class="lg:col-span-2 space-y-6">
            <ui-panel-section
              .title=${__('Caratteristiche')}
              icon="list"
              .renderContent=${() => html`
                <div class="flex flex-wrap gap-2 mb-4">
                  <ui-badge
                    variant="primary"
                    .label=${getReferenceTypeLabel(item.referenceType)}
                  ></ui-badge>
                  <ui-badge
                    variant="secondary"
                    .label=${getContentDurationLabel(item.duration)}
                  ></ui-badge>
                  <ui-badge
                    variant="secondary"
                    .label=${getLanguageLevelLabel(item.languageLevel)}
                  ></ui-badge>
                </div>

                <dl class="grid grid-cols-2 gap-4">
                  ${this.renderDetailRow(__('Riferimento Wikidata'), item.referenceId)}
                  ${this.renderDetailRow(__('Licenza'), item.license || __('N/D'))}
                  ${this.renderDetailRow(
                    __('Prezzo'),
                    item.isFree ? __('Gratuito') : `€${item.price || 0}`,
                  )}
                  ${this.renderDetailRow(__('Autore'), item.authorName)}
                </dl>
              `}
            ></ui-panel-section>
            <ui-panel-section
              .title=${__('Testo')}
              icon="document"
              .renderContent=${() => html`
                <div class="flex justify-end mb-2">
                  <ui-button
                    size="sm"
                    variant="secondary"
                    icon=${this.playingItemId === item._id ? 'pause' : 'play'}
                    .label=${this.playingItemId === item._id ? __('Interrompi') : __('Ascolta')}
                    @click=${() => this.togglePlayback(item, text)}
                  ></ui-button>
                </div>
                <p class="text-surface-700 dark:text-surface-300 whitespace-pre-wrap">${text}</p>
              `}
            ></ui-panel-section>
            ${item.tags && item.tags.length > 0
              ? html`
                  <ui-panel-section
                    .title=${__('Tag')}
                    icon="tag"
                    .renderContent=${() => html`
                      <div class="flex flex-wrap gap-2">
                        ${item.tags?.map(
                          (tag) => html`<ui-badge variant="secondary" .label=${tag}></ui-badge>`,
                        )}
                      </div>
                    `}
                  ></ui-panel-section>
                `
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private renderEditView() {
    if (!this.selectedItem) return this.renderListView();

    return html`
      <div class="space-y-6">
        <ui-page-header
          .title=${__('Modifica Contenuto')}
          description=${this.selectedItem.title}
          showBack
          @back=${this.backToListView}
        ></ui-page-header>

        <item-creator
          itemId="${this.selectedItem._id}"
          @item-created=${() => this.loadItems()}
          @cancel=${this.backToListView}
        ></item-creator>
      </div>
    `;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      ${this.viewMode === 'create'
        ? this.renderCreateView()
        : this.viewMode === 'edit'
          ? this.renderEditView()
          : this.viewMode === 'view'
            ? this.renderViewMode()
            : this.renderListView()}
      <ui-modal
        ?open=${this.deleteModalOpen}
        .title=${__('Elimina Contenuto')}
        .message=${__(
          'Sei sicuro di voler eliminare questo contenuto? Questa azione non può essere annullata.',
        )}
        variant="danger"
        .confirmLabel=${__('Elimina')}
        .cancelLabel=${__('Annulla')}
        ?loading=${this.deleting}
        @confirm=${this.handleConfirmDelete}
        @cancel=${() => this.closeDeleteModal()}
      ></ui-modal>
    `;
  }
}
