import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { itemService, type ItemFilters } from '../../services/item.service';
import { preferencesService } from '../../services/preferences.service';
import type { Item } from '@artaround/shared';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-badge';
import '../ui/ui-modal';
import '../items/item-creator';

type ViewMode = 'list' | 'create' | 'edit' | 'view';

@customElement('artworks-page')
export class ArtworksPage extends LitElement {
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

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadItems();
  }

  private async loadItems() {
    this.loading = true;
    this.error = '';

    try {
      const museumId = preferencesService.getSelectedMuseumId();
      const filters: ItemFilters = {
        page: this.pagination.page,
        limit: this.pagination.limit,
      };

      if (museumId) {
        filters.museumId = museumId;
      }

      const result = await itemService.getItems(filters);
      this.items = result.items;
      this.pagination = result.pagination;
    } catch (e) {
      console.error('Error loading items:', e);
      this.error = 'Impossibile caricare le opere';
    } finally {
      this.loading = false;
    }
  }

  private async handleSearch() {
    if (!this.searchQuery.trim()) {
      this.loadItems();
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const museumId = preferencesService.getSelectedMuseumId();
      const result = await itemService.searchItems(this.searchQuery, {
        museumId: museumId || undefined,
        page: 1,
        limit: this.pagination.limit,
      });
      this.items = result.items;
      this.pagination = result.pagination;
    } catch (e) {
      console.error('Error searching items:', e);
      this.error = 'Errore durante la ricerca';
    } finally {
      this.loading = false;
    }
  }

  private handleSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.handleSearch();
    }
  }

  private handleItemCreated() {
    this.viewMode = 'list';
    this.loadItems();
  }

  private handleCancelCreate() {
    this.viewMode = 'list';
  }

  private handleDeleteItem(item: Item) {
    this.itemToDelete = item;
    this.deleteModalOpen = true;
  }

  private handleCancelDelete() {
    this.deleteModalOpen = false;
    this.itemToDelete = null;
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
      this.error = "Errore durante l'eliminazione";
    } finally {
      this.deleting = false;
    }
  }

  private handleViewItem(item: Item) {
    this.selectedItem = item;
    this.viewMode = 'view';
  }

  private handleEditItem(item: Item) {
    this.selectedItem = item;
    this.viewMode = 'edit';
  }

  private renderListView() {
    return html`
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-surface-900 dark:text-white">Opere</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Gestisci i contenuti delle opere d'arte
            </p>
          </div>

          <ui-button
            variant="primary"
            icon="plus"
            label="Nuova Opera"
            @click=${() => (this.viewMode = 'create')}
          ></ui-button>
        </div>

        <!-- Search -->
        <div class="flex gap-2">
          <div class="flex-1 max-w-md">
            <ui-input
              placeholder="Cerca opere..."
              .value=${this.searchQuery}
              @input-change=${(e: CustomEvent) => (this.searchQuery = e.detail.value)}
              @keydown=${this.handleSearchKeydown}
            ></ui-input>
          </div>
          <ui-button
            variant="secondary"
            icon="search"
            label="Cerca"
            @click=${this.handleSearch}
          ></ui-button>
        </div>

        <!-- Content -->
        ${this.loading
          ? this.renderSkeleton()
          : this.error
            ? this.renderError()
            : this.items.length === 0
              ? this.renderEmpty()
              : this.renderGrid()}

        <!-- Pagination -->
        ${this.pagination.totalPages > 1
          ? html`
              <div
                class="flex items-center justify-between pt-4 border-t border-surface-200 dark:border-surface-700"
              >
                <p class="text-sm text-surface-500 dark:text-surface-400">
                  Pagina ${this.pagination.page} di ${this.pagination.totalPages}
                  (${this.pagination.total} opere totali)
                </p>
                <div class="flex gap-2">
                  <ui-button
                    variant="secondary"
                    size="sm"
                    label="Precedente"
                    ?disabled=${this.pagination.page <= 1}
                    @click=${() => {
                      this.pagination.page--;
                      this.loadItems();
                    }}
                  ></ui-button>
                  <ui-button
                    variant="secondary"
                    size="sm"
                    label="Successiva"
                    ?disabled=${this.pagination.page >= this.pagination.totalPages}
                    @click=${() => {
                      this.pagination.page++;
                      this.loadItems();
                    }}
                  ></ui-button>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }

  private renderCreateView() {
    return html`
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click=${() => (this.viewMode = 'list')}
          >
            <ui-icon name="arrowLeft" size="sm"></ui-icon>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-surface-900 dark:text-white">Nuova Opera</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Crea un nuovo contenuto per un'opera d'arte
            </p>
          </div>
        </div>

        <!-- Creator Form -->
        <item-creator
          @item-created=${this.handleItemCreated}
          @cancel=${this.handleCancelCreate}
        ></item-creator>
      </div>
    `;
  }

  private renderSkeleton() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${[1, 2, 3, 4, 5, 6].map(
          () => html`
            <div class="animate-pulse">
              <div class="aspect-video bg-surface-200 dark:bg-surface-800 rounded-t-xl"></div>
              <div
                class="p-4 bg-white dark:bg-surface-900 rounded-b-xl border border-t-0 border-surface-200 dark:border-surface-800"
              >
                <div class="h-5 bg-surface-200 dark:bg-surface-700 rounded w-3/4 mb-2"></div>
                <div class="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/2 mb-3"></div>
                <div class="flex gap-2">
                  <div class="h-6 bg-surface-200 dark:bg-surface-700 rounded w-16"></div>
                  <div class="h-6 bg-surface-200 dark:bg-surface-700 rounded w-20"></div>
                </div>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  private renderError() {
    return html`
      <div class="text-center py-12">
        <ui-icon name="warning" size="lg" class="text-danger-500 mx-auto mb-4"></ui-icon>
        <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-2">Errore</h3>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">${this.error}</p>
        <ui-button variant="secondary" label="Riprova" @click=${this.loadItems}></ui-button>
      </div>
    `;
  }

  private renderEmpty() {
    return html`
      <div class="text-center py-12">
        <ui-icon
          name="image"
          size="lg"
          class="text-surface-300 dark:text-surface-600 mx-auto mb-4"
        ></ui-icon>
        <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-2">Nessuna opera</h3>
        <p class="text-sm text-surface-500 dark:text-surface-400 mb-4">
          ${this.searchQuery
            ? 'Nessun risultato per la ricerca'
            : 'Non ci sono ancora opere per questo museo'}
        </p>
        <ui-button
          variant="primary"
          icon="plus"
          label="Crea la prima opera"
          @click=${() => (this.viewMode = 'create')}
        ></ui-button>
      </div>
    `;
  }

  private renderGrid() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${this.items.map((item) => this.renderItemCard(item))}
      </div>
    `;
  }

  private renderItemCard(item: Item) {
    const contentsCount = item.contents?.length || 0;

    return html`
      <ui-card padding="none" hover>
        <!-- Image -->
        <div
          class="aspect-video bg-surface-100 dark:bg-surface-800 relative overflow-hidden rounded-t-xl"
        >
          ${item.image
            ? html`
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" />
              `
            : html`
                <div class="w-full h-full flex items-center justify-center">
                  <ui-icon
                    name="image"
                    size="lg"
                    class="text-surface-300 dark:text-surface-600"
                  ></ui-icon>
                </div>
              `}

          <!-- Price badge -->
          <div class="absolute top-3 right-3">
            ${item.metadata?.isFree
              ? html`
                  <span
                    class="px-2 py-1 rounded-full text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-300"
                  >
                    Gratuito
                  </span>
                `
              : html`
                  <span
                    class="px-2 py-1 rounded-full text-xs font-medium bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-300"
                  >
                    €${item.metadata?.price || 0}
                  </span>
                `}
          </div>
        </div>

        <!-- Content -->
        <div class="p-4">
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-1">
            ${item.title}
          </h3>

          ${item.metadata?.author
            ? html`
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-3">
                  ${item.metadata.author}
                </p>
              `
            : ''}

          <!-- Stats -->
          <div class="flex items-center gap-3 text-xs text-surface-400 mb-3">
            <span class="flex items-center gap-1">
              <ui-icon name="document" size="xs"></ui-icon>
              ${contentsCount} contenuti
            </span>
            <span class="flex items-center gap-1">
              <ui-icon name="link" size="xs"></ui-icon>
              ${item.objectId}
            </span>
          </div>

          <!-- Tags -->
          ${item.metadata?.tags && item.metadata.tags.length > 0
            ? html`
                <div class="flex flex-wrap gap-1 mb-3">
                  ${item.metadata.tags
                    .slice(0, 3)
                    .map(
                      (tag) => html`
                        <span
                          class="px-2 py-0.5 rounded text-xs bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
                        >
                          ${tag}
                        </span>
                      `,
                    )}
                  ${item.metadata.tags.length > 3
                    ? html`
                        <span
                          class="px-2 py-0.5 rounded text-xs bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400"
                        >
                          +${item.metadata.tags.length - 3}
                        </span>
                      `
                    : ''}
                </div>
              `
            : ''}

          <!-- Actions -->
          <div
            class="flex items-center justify-end gap-2 pt-3 border-t border-surface-100 dark:border-surface-800"
          >
            <button
              type="button"
              class="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
              title="Visualizza"
              @click=${() => this.handleViewItem(item)}
            >
              <ui-icon name="eye" size="xs"></ui-icon>
            </button>
            <button
              type="button"
              class="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
              title="Modifica"
              @click=${() => this.handleEditItem(item)}
            >
              <ui-icon name="edit" size="xs"></ui-icon>
            </button>
            <button
              type="button"
              class="p-2 text-surface-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
              title="Elimina"
              @click=${() => this.handleDeleteItem(item)}
            >
              <ui-icon name="trash" size="xs"></ui-icon>
            </button>
          </div>
        </div>
      </ui-card>
    `;
  }

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
        title="Elimina Opera"
        message='Sei sicuro di voler eliminare "${this.itemToDelete
          ?.title}" ? Questa azione non può essere annullata.'
        variant="danger"
        confirmLabel="Elimina"
        cancelLabel="Annulla"
        ?loading=${this.deleting}
        @confirm=${this.handleConfirmDelete}
        @cancel=${this.handleCancelDelete}
      ></ui-modal>
    `;
  }

  private renderViewMode() {
    if (!this.selectedItem) return this.renderListView();

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click=${() => {
              this.viewMode = 'list';
              this.selectedItem = null;
            }}
          >
            <ui-icon name="arrowLeft" size="sm"></ui-icon>
          </button>
          <div class="flex-1">
            <h1 class="text-2xl font-bold text-surface-900 dark:text-white">
              ${this.selectedItem.title}
            </h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              ${this.selectedItem.objectId}
            </p>
          </div>
          <ui-button
            variant="primary"
            icon="edit"
            label="Modifica"
            @click=${() => (this.viewMode = 'edit')}
          ></ui-button>
        </div>

        <!-- Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Image -->
          <div class="lg:col-span-1">
            <ui-card>
              <div
                class="aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden"
              >
                ${this.selectedItem.image
                  ? html`
                      <img
                        src="${this.selectedItem.image}"
                        alt="${this.selectedItem.title}"
                        class="w-full h-full object-cover"
                      />
                    `
                  : html`
                      <div class="w-full h-full flex items-center justify-center">
                        <ui-icon
                          name="image"
                          size="xl"
                          class="text-surface-300 dark:text-surface-600"
                        ></ui-icon>
                      </div>
                    `}
              </div>
            </ui-card>
          </div>

          <!-- Details -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Metadata -->
            <ui-card>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4">Dettagli</h3>
              <dl class="grid grid-cols-2 gap-4">
                ${this.selectedItem.metadata?.author
                  ? html`
                      <div>
                        <dt
                          class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                        >
                          Artista
                        </dt>
                        <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">
                          ${this.selectedItem.metadata.author}
                        </dd>
                      </div>
                    `
                  : ''}
                ${this.selectedItem.metadata?.style
                  ? html`
                      <div>
                        <dt
                          class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                        >
                          Stile
                        </dt>
                        <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">
                          ${this.selectedItem.metadata.style}
                        </dd>
                      </div>
                    `
                  : ''}
                ${this.selectedItem.metadata?.epoch
                  ? html`
                      <div>
                        <dt
                          class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                        >
                          Epoca
                        </dt>
                        <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">
                          ${this.selectedItem.metadata.epoch}
                        </dd>
                      </div>
                    `
                  : ''}
                <div>
                  <dt
                    class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                  >
                    Licenza
                  </dt>
                  <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">
                    ${this.selectedItem.metadata?.license || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt
                    class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                  >
                    Prezzo
                  </dt>
                  <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">
                    ${this.selectedItem.metadata?.isFree
                      ? 'Gratuito'
                      : `€${this.selectedItem.metadata?.price || 0}`}
                  </dd>
                </div>
              </dl>
            </ui-card>

            <!-- Contents -->
            <ui-card>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-4">
                Contenuti (${this.selectedItem.contents?.length || 0})
              </h3>
              ${this.selectedItem.contents && this.selectedItem.contents.length > 0
                ? html`
                    <div class="space-y-3">
                      ${this.selectedItem.contents.map(
                        (content) => html`
                          <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                            <div class="flex items-center gap-2 mb-2">
                              <ui-badge variant="primary" size="sm">${content.duration}</ui-badge>
                              <ui-badge variant="secondary" size="sm">${content.language}</ui-badge>
                            </div>
                            <p class="text-sm text-surface-700 dark:text-surface-300 line-clamp-3">
                              ${content.text}
                            </p>
                          </div>
                        `,
                      )}
                    </div>
                  `
                : html`
                    <p class="text-sm text-surface-500 dark:text-surface-400">
                      Nessun contenuto disponibile
                    </p>
                  `}
            </ui-card>
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
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="p-2 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            @click=${() => {
              this.viewMode = 'list';
              this.selectedItem = null;
            }}
          >
            <ui-icon name="arrowLeft" size="sm"></ui-icon>
          </button>
          <div>
            <h1 class="text-2xl font-bold text-surface-900 dark:text-white">Modifica Opera</h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              ${this.selectedItem.title}
            </p>
          </div>
        </div>

        <!-- Edit Form -->
        <item-creator
          itemId="${this.selectedItem._id}"
          @item-created=${() => {
            this.viewMode = 'list';
            this.selectedItem = null;
            this.loadItems();
          }}
          @cancel=${() => {
            this.viewMode = 'list';
            this.selectedItem = null;
          }}
        ></item-creator>
      </div>
    `;
  }
}
