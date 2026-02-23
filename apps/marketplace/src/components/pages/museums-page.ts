import { LitElement, html } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import type { Museum, User } from '@artaround/shared';
import { museumService } from '../../services/museum.service';
import { artworkService } from '../../services/artwork.service';
import { itemService } from '../../services/item.service';
import { visitService } from '../../services/visit.service';
import { preferencesService } from '../../services/preferences.service';
import type { TableColumn } from '../ui/ui-table';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-search-bar';
import '../ui/ui-table';
import '../ui/ui-button';

type FilterRole = 'all' | 'curator' | 'author';

interface MuseumStats {
  artworks: number;
  items: number;
  visits: number;
}

@customElement('museums-page')
export class MuseumsPage extends LitElement {
  @property({ type: Object }) user: User | null = null;

  @state() private museums: Museum[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private searchQuery = '';
  @state() private currentSelectedMuseumId = '';
  @state() private filterRole: FilterRole = 'all';
  @state() private museumStats: Map<string, MuseumStats> = new Map();
  @state() private loadingStats = false;

  private get columns(): TableColumn[] {
    return [
    {
      key: 'name',
      label: 'Museo',
      width: '40%',
      render: (value, row) => {
        const museum = row as unknown as Museum;
        const imageUrl = museum.coverImage || (museum.images && museum.images[0]);
        const myRoles = this.getMuseumRoles(museum._id);
        return html`
          <div class="flex items-center gap-4 py-2">
            ${imageUrl
              ? html`
                  <img
                    src="${imageUrl}"
                    alt="${value}"
                    class="w-24 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm"
                    @error=${(e: Event) => {
                      const img = e.target as HTMLImageElement;
                      img.style.display = 'none';
                      const fallback = img.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    class="w-24 h-16 rounded-lg bg-brand-100 dark:bg-brand-900/30 items-center justify-center flex-shrink-0 hidden"
                  >
                    <ui-icon name="location" size="md" class="text-brand-600 dark:text-brand-400"></ui-icon>
                  </div>
                `
              : html`
                  <div
                    class="w-24 h-16 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
                  >
                    <ui-icon name="location" size="md" class="text-brand-600 dark:text-brand-400"></ui-icon>
                  </div>
                `}
            <div class="min-w-0 max-w-xs">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-surface-900 dark:text-white truncate text-base">
                  ${value}
                </p>
                ${museum._id === this.currentSelectedMuseumId
                  ? html`<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500 text-white flex-shrink-0">Selezionato</span>`
                  : ''}
                ${myRoles.includes('manager')
                  ? html`<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 flex-shrink-0">Curatore</span>`
                  : ''}
                ${myRoles.includes('author')
                  ? html`<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 flex-shrink-0">Autore</span>`
                  : ''}
              </div>
              <p class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 max-w-[300px]">
                ${museum.description || 'Nessuna descrizione'}
              </p>
            </div>
          </div>
        `;
      },
    },
    {
      key: 'stats',
      label: 'Statistiche',
      width: '20%',
      render: (_, row) => {
        const museum = row as unknown as Museum;
        const stats = this.museumStats.get(museum._id);
        if (this.loadingStats && !stats) {
          return html`<span class="text-sm text-surface-400">Caricamento...</span>`;
        }
        if (!stats) {
          return html`<span class="text-sm text-surface-400">-</span>`;
        }
        return html`
          <div class="flex flex-col gap-1 text-sm">
            <div class="flex items-center gap-1.5 text-surface-600 dark:text-surface-300">
              <ui-icon name="image" size="xs" class="text-surface-400"></ui-icon>
              <span>${stats.artworks} opere</span>
            </div>
            <div class="flex items-center gap-1.5 text-surface-600 dark:text-surface-300">
              <ui-icon name="text" size="xs" class="text-surface-400"></ui-icon>
              <span>${stats.items} contenuti</span>
            </div>
            <div class="flex items-center gap-1.5 text-surface-600 dark:text-surface-300">
              <ui-icon name="visit" size="xs" class="text-surface-400"></ui-icon>
              <span>${stats.visits} visite</span>
            </div>
          </div>
        `;
      },
    },
    {
      key: 'city',
      label: 'Città',
      width: '15%',
      render: (_, row) => html`
        <div class="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
          <ui-icon name="location" size="xs" class="text-surface-400"></ui-icon>
          <span>${(row as unknown as Museum).location?.city || '-'}</span>
        </div>
      `,
    },
    {
      key: 'country',
      label: 'Paese',
      width: '15%',
      render: (_, row) => html`
        <span class="text-sm text-surface-600 dark:text-surface-300">
          ${(row as unknown as Museum).location?.country || '-'}
        </span>
      `,
    },
    {
      key: 'actions',
      label: '',
      width: '150px',
      align: 'right' as const,
      render: (_, row) => html`
        <ui-button
          variant="primary"
          size="sm"
          icon="check"
          label="Seleziona"
          @click=${(e: Event) => {
            e.stopPropagation();
            this.selectMuseum(row as unknown as Museum);
          }}
        ></ui-button>
      `,
    },
  ];
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadMuseums();
    this.currentSelectedMuseumId = preferencesService.getSelectedMuseumId() || '';
  }

  private async loadMuseums() {
    this.loading = true;
    this.error = '';

    try {
      this.museums = await museumService.getMuseums();
      // Load stats in background
      this.loadMuseumStats();
    } catch (e) {
      console.error('Error loading museums:', e);
      this.error = 'Impossibile caricare i musei';
    } finally {
      this.loading = false;
    }
  }

  private async loadMuseumStats() {
    this.loadingStats = true;
    
    // Load stats for each museum in parallel (but in batches to avoid too many requests)
    const batchSize = 5;
    for (let i = 0; i < this.museums.length; i += batchSize) {
      const batch = this.museums.slice(i, i + batchSize);
      await Promise.all(batch.map(museum => this.loadStatsForMuseum(museum)));
      // Trigger re-render after each batch
      this.requestUpdate();
    }
    
    this.loadingStats = false;
  }

  private async loadStatsForMuseum(museum: Museum) {
    try {
      // Use wikidataId for filtering as that's what the API expects
      const museumId = museum.wikidataId || museum._id;
      const [artworksRes, itemsRes, visitsRes] = await Promise.all([
        artworkService.getArtworks({ museumId, limit: 1 }),
        itemService.getItems({ museumId, limit: 1 }),
        visitService.getVisits({ museumId, limit: 1 }),
      ]);
      
      this.museumStats.set(museum._id, {
        artworks: artworksRes.pagination.total,
        items: itemsRes.pagination.total,
        visits: visitsRes.pagination.total,
      });
    } catch (e) {
      console.error(`Error loading stats for museum ${museum._id}:`, e);
    }
  }

  private getMuseumRoles(museumId: string): string[] {
    if (!this.user?.roleAssignments) return [];
    
    return this.user.roleAssignments
      .filter(ra => ra.resourceType === 'museum' && ra.resourceId === museumId)
      .map(ra => ra.role);
  }

  private get filteredMuseums(): Museum[] {
    let filtered = this.museums;

    // Filter by role
    if (this.filterRole !== 'all' && this.user?.roleAssignments) {
      const targetRole = this.filterRole === 'curator' ? 'manager' : 'author';
      const myMuseumIds = this.user.roleAssignments
        .filter(ra => ra.resourceType === 'museum' && ra.role === targetRole)
        .map(ra => ra.resourceId);
      filtered = filtered.filter(museum => myMuseumIds.includes(museum._id));
    }

    // Filter by search
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (museum) =>
          museum.name.toLowerCase().includes(query) ||
          museum.location?.city?.toLowerCase().includes(query) ||
          museum.location?.country?.toLowerCase().includes(query) ||
          museum.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  private handleSearch(e: CustomEvent<{ value?: string }>) {
    if (e.detail?.value !== undefined) {
      this.searchQuery = e.detail.value;
    }
  }

  private selectMuseum(museum: Museum) {
    this.currentSelectedMuseumId = museum._id;
    this.dispatchEvent(
      new CustomEvent('museum-confirmed', {
        detail: museum,
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="space-y-6 animate-fade-in">
        <!-- Header -->
        <ui-page-header
          title="Seleziona Museo"
          description="Scegli il museo su cui vuoi lavorare"
        ></ui-page-header>

        <!-- Search and Filters -->
        <ui-card padding="md">
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1">
              <ui-search-bar
                placeholder="Cerca museo per nome, città o paese..."
                .value=${this.searchQuery}
                @search=${this.handleSearch}
                @input=${this.handleSearch}
              ></ui-search-bar>
            </div>
            ${this.user ? html`
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm text-surface-500 dark:text-surface-400">Mostra:</span>
                <button
                  type="button"
                  class="px-3 py-1.5 text-sm rounded-full transition-colors ${this.filterRole === 'all'
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'}"
                  @click=${() => this.filterRole = 'all'}
                >
                  Tutti
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-sm rounded-full transition-colors ${this.filterRole === 'curator'
                    ? 'bg-success-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'}"
                  @click=${() => this.filterRole = 'curator'}
                >
                  I miei (Curatore)
                </button>
                <button
                  type="button"
                  class="px-3 py-1.5 text-sm rounded-full transition-colors ${this.filterRole === 'author'
                    ? 'bg-warning-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'}"
                  @click=${() => this.filterRole = 'author'}
                >
                  I miei (Autore)
                </button>
              </div>
            ` : ''}
          </div>
        </ui-card>

        <!-- Content -->
        ${this.loading
          ? html`<ui-loading size="lg" text="Caricamento musei..."></ui-loading>`
          : this.error
            ? html`
                <ui-alert
                  variant="danger"
                  title="Errore"
                  .message=${this.error}
                  showRetry
                  @retry=${this.loadMuseums}
                ></ui-alert>
              `
            : this.filteredMuseums.length === 0
              ? html`
                  <ui-empty
                    icon="folder"
                    title=${this.searchQuery ? 'Nessun risultato' : 'Nessun museo'}
                    description=${this.searchQuery
                      ? 'Nessun museo corrisponde alla ricerca'
                      : 'Non ci sono musei disponibili al momento.'}
                  ></ui-empty>
                `
              : html`
                  <ui-table
                    .columns=${this.columns}
                    .data=${this.filteredMuseums as unknown as Record<string, unknown>[]}
                    .selectedRowId=${this.currentSelectedMuseumId}
                    rowKeyField="_id"
                    striped
                  ></ui-table>
                `}
      </div>
    `;
  }
}
