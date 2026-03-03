import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { AppBaseElement, MuseumAwareMixin } from '../../base';
import { itemService } from '../../services/item.service';
import {
  getContentDurationLabel,
  getLanguageLevelLabel,
  getReferenceTypeLabel,
  type Item,
  type User,
} from '@artaround/shared';
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
import '../ui/ui-pagination';
import '../ui/ui-search-bar';
import '../ui/ui-icon-button';
import '../ui/ui-data-grid';
import '../ui/ui-media-card';
import '../ui/ui-museum-required-notice';
import '../ui/ui-panel-section';
import '../items/item-creator';
import { __ } from '../../services/i18n.service';

type ViewMode = 'list' | 'create' | 'edit' | 'view';
/**
 * Contents Page
 *
 * Displays and manages content Items (text/audio descriptions).
 * Each Item is a single content piece with a specific duration and language level.
 */
@customElement('contents-page')
export class ContentsPage extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) authorOnly = false;

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
  @state() private deleteModalOpen = false;
  @state() private itemToDelete: Item | null = null;
  @state() private deleting = false;
  @state() private ownItemsCache: Item[] = [];

  // ─── Computed State ──────────────────────────────────────
  private get permissions(): PermissionSet {
    return getPermissions(this.user);
  }

  // ─── Lifecycle ───────────────────────────────────────────
  connectedCallback() {
    super.connectedCallback();
    this.loadItems();
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('viewMode')) {
      this.scrollToTop();
    }
  }

  onMuseumChanged(): void {
    this.pagination.page = 1;
    this.loadItems();
  }

  // ─── Data Loading ────────────────────────────────────────
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
        const visibleItems = this.searchQuery.trim()
          ? filteredByMuseum.filter((item) => {
              const q = this.searchQuery.toLowerCase();
              return item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
            })
          : filteredByMuseum;

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

  private async handleSearch() {
    if (this.authorOnly) {
      const query = this.searchQuery.trim().toLowerCase();
      this.items = query
        ? this.ownItemsCache.filter(
            (item) =>
              item.title.toLowerCase().includes(query) || item.text.toLowerCase().includes(query),
          )
        : [...this.ownItemsCache];
      this.pagination = {
        page: 1,
        limit: Math.max(this.items.length, 1),
        total: this.items.length,
        totalPages: 1,
      };
      return;
    }

    if (!this.searchQuery.trim()) {
      this.loadItems();
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const result = await itemService.searchItems(this.searchQuery, {
        page: 1,
        limit: this.pagination.limit,
        museumId: this.selectedMuseumId || undefined,
      });
      this.items = result.items;
      this.pagination = result.pagination;
    } catch (e) {
      console.error('Error searching items:', e);
      this.error = __('Errore durante la ricerca');
    } finally {
      this.loading = false;
    }
  }

  // ─── List / Form Actions ─────────────────────────────────
  private handleViewItem(item: Item) {
    this.selectedItem = item;
    this.viewMode = 'view';
  }

  private handleEditItem(item: Item) {
    if (!this.permissions.canEditItem) {
      this.error = __('Non hai i permessi per modificare i contenuti.');
      return;
    }
    this.selectedItem = item;
    this.viewMode = 'edit';
  }

  private handleDeleteItem(item: Item) {
    if (!this.permissions.canDeleteItem) {
      this.error = __('Non hai i permessi per eliminare i contenuti.');
      return;
    }
    this.itemToDelete = item;
    this.deleteModalOpen = true;
  }

  private async handleConfirmDelete() {
    if (!this.itemToDelete) return;

    this.deleting = true;
    try {
      await itemService.deleteItem(this.itemToDelete._id);
      this.deleteModalOpen = false;
      this.itemToDelete = null;
      this.loadItems();
    } catch (e) {
      console.error('Error deleting item:', e);
    } finally {
      this.deleting = false;
    }
  }

  private handleCancelDelete() {
    this.deleteModalOpen = false;
    this.itemToDelete = null;
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

  // ─── Render Helpers ──────────────────────────────────────
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

  private renderListView() {
    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          .title=${__('Contenuti')}
          .count=${this.pagination.total}
          .countLabel=${__('contenuti totali')}
          .description=${__('Testi descrittivi per opere, autori, movimenti')}
        >
          <div slot="actions" class="flex items-center gap-3">
            <ui-search-bar
              .placeholder=${__('Cerca contenuti...')}
              .value=${this.searchQuery}
              @input-change=${(e: CustomEvent) => (this.searchQuery = e.detail.value)}
              @search=${this.handleSearch}
            ></ui-search-bar>
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

        <!-- Content -->
        ${this.loading
          ? html`<ui-loading .text=${__('Caricamento contenuti...')}></ui-loading>`
          : this.error
            ? html`<ui-alert
                variant="danger"
                message=${this.error}
                showRetry
                @retry=${this.loadItems}
              ></ui-alert>`
            : this.items.length === 0
              ? this.renderEmpty()
              : this.renderGrid()}

        <!-- Pagination -->
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
        <!-- Header -->
        <ui-page-header
          .title=${__('Nuovo Contenuto')}
          .description=${__('Crea un nuovo contenuto descrittivo')}
          showBack
          @back=${this.backToListView}
        ></ui-page-header>

        <!-- Form -->
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
    return html`
      <ui-media-card
        .imageSrc=${item.image || ''}
        .imageAlt=${item.title}
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
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${item.title}
          </h3>

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

          <p class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2 mb-3">
            ${item.text}
          </p>

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
              icon="eye"
              .title=${__('Visualizza')}
              @click=${() => this.handleViewItem(item)}
            ></ui-icon-button>
            ${this.permissions.canEditItem
              ? html`
                  <ui-icon-button
                    icon="edit"
                    .title=${__('Modifica')}
                    @click=${() => this.handleEditItem(item)}
                  ></ui-icon-button>
                `
              : nothing}
            ${this.permissions.canDeleteItem
              ? html`
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

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          title=${this.selectedItem.title}
          .description=${this.selectedItem.referenceTitle || __('Contenuto')}
          showBack
          @back=${this.backToListView}
        >
          ${this.permissions.canEditItem
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

        <!-- Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Image -->
          <div class="lg:col-span-1">
            <ui-card>${this.renderSelectedItemImage()}</ui-card>
          </div>

          <!-- Details -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Characteristics -->
            <ui-panel-section
              .title=${__('Caratteristiche')}
              icon="list"
              .renderContent=${() => html`
                <div class="flex flex-wrap gap-2 mb-4">
                  <ui-badge
                    variant="primary"
                    .label=${getReferenceTypeLabel(this.selectedItem!.referenceType)}
                  ></ui-badge>
                  <ui-badge
                    variant="secondary"
                    .label=${getContentDurationLabel(this.selectedItem!.duration)}
                  ></ui-badge>
                  <ui-badge
                    variant="secondary"
                    .label=${getLanguageLevelLabel(this.selectedItem!.languageLevel)}
                  ></ui-badge>
                </div>

                <dl class="grid grid-cols-2 gap-4">
                  ${this.renderDetailRow(
                    __('Riferimento Wikidata'),
                    this.selectedItem!.referenceId,
                  )}
                  ${this.renderDetailRow(__('Licenza'), this.selectedItem!.license || __('N/D'))}
                  ${this.renderDetailRow(
                    __('Prezzo'),
                    this.selectedItem!.isFree
                      ? __('Gratuito')
                      : `€${this.selectedItem!.price || 0}`,
                  )}
                  ${this.renderDetailRow(__('Autore'), this.selectedItem!.authorName)}
                </dl>
              `}
            ></ui-panel-section>

            <!-- Text Content -->
            <ui-panel-section
              .title=${__('Testo')}
              icon="document"
              .renderContent=${() => html`
                <p class="text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                  ${this.selectedItem!.text}
                </p>
              `}
            ></ui-panel-section>

            <!-- Tags -->
            ${this.selectedItem.tags && this.selectedItem.tags.length > 0
              ? html`
                  <ui-panel-section
                    .title=${__('Tag')}
                    icon="tag"
                    .renderContent=${() => html`
                      <div class="flex flex-wrap gap-2">
                        ${this.selectedItem!.tags?.map(
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
        <!-- Header -->
        <ui-page-header
          .title=${__('Modifica Contenuto')}
          description=${this.selectedItem.title}
          showBack
          @back=${this.backToListView}
        ></ui-page-header>

        <!-- Edit Form -->
        <item-creator
          itemId="${this.selectedItem._id}"
          @item-created=${() => {
            this.backToListView();
            this.loadItems();
          }}
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

      <!-- Delete Confirmation Modal -->
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
        @cancel=${this.handleCancelDelete}
      ></ui-modal>
    `;
  }
}
