import { LitElement, html, nothing } from 'lit';
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
import { __, i18nService } from '../../services/i18n.service';

type FilterRole = 'all' | 'curator' | 'author';

interface MuseumStats {
  artworks: number;
  items: number;
  visits: number;
}

type MuseumTagType = 'selected' | 'curator' | 'author';

@customElement('museums-page')
export class MuseumsPage extends LitElement {
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) embedded = false;

  @state() private museums: Museum[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private searchQuery = '';
  @state() private currentSelectedMuseumId = '';
  @state() private filterRole: FilterRole = 'all';
  @state() private museumStats: Map<string, MuseumStats> = new Map();
  @state() private loadingStats = false;

  // ─── Helper di render ──────────────────────────────────────
  private renderMuseumTag(type: MuseumTagType) {
    const config: Record<MuseumTagType, { label: string; classes: string }> = {
      selected: {
        label: __('Selezionato'),
        classes: 'bg-brand-500 text-white',
      },
      curator: {
        label: __('Curatore'),
        classes: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400',
      },
      author: {
        label: __('Autore'),
        classes: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
      },
    };

    return html`
      <span
        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${config[
          type
        ].classes}"
      >
        ${config[type].label}
      </span>
    `;
  }

  private renderMuseumStatLine(icon: string, label: string) {
    return html`
      <div class="flex items-center gap-1.5 text-surface-600 dark:text-surface-300">
        <ui-icon name=${icon} size="xs" class="text-surface-400"></ui-icon>
        <span>${label}</span>
      </div>
    `;
  }

  private renderMuseumPreview(imageUrl: string, museumName: string) {
    const fallback = html`
      <div
        class="w-24 h-16 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0"
      >
        <ui-icon name="location" size="md" class="text-brand-600 dark:text-brand-400"></ui-icon>
      </div>
    `;

    if (!imageUrl) {
      return fallback;
    }

    return html`
      <img
        src="${imageUrl}"
        alt="${museumName}"
        class="w-24 h-16 rounded-lg object-cover flex-shrink-0 shadow-sm"
        @error=${(e: Event) => {
          const img = e.target as HTMLImageElement;
          img.style.display = 'none';
          const fallbackElement = img.nextElementSibling as HTMLElement;
          if (fallbackElement) fallbackElement.style.display = 'flex';
        }}
      />
      <div
        class="w-24 h-16 rounded-lg bg-brand-100 dark:bg-brand-900/30 items-center justify-center flex-shrink-0 hidden"
      >
        <ui-icon name="location" size="md" class="text-brand-600 dark:text-brand-400"></ui-icon>
      </div>
    `;
  }

  private renderLocationCell(value: string, withIcon = false) {
    const normalizedValue = value || '-';

    if (!withIcon) {
      return html`<span class="text-sm text-surface-600 dark:text-surface-300"
        >${normalizedValue}</span
      >`;
    }

    return html`
      <div class="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
        <ui-icon name="location" size="xs" class="text-surface-400"></ui-icon>
        <span>${normalizedValue}</span>
      </div>
    `;
  }

  private getMuseumCity(museum: Museum): string {
    return museum.location?.city || '-';
  }

  private getMuseumCountry(museum: Museum): string {
    return museum.location?.country || '-';
  }

  private getLocalizedMuseumName(museum: Museum): string {
    const currentLanguage = i18nService.getLanguage();
    if (currentLanguage === 'it') {
      return museum.name || __('Museo');
    }

    return museum.nameTranslations?.[currentLanguage]?.trim() || museum.name || __('Museo');
  }

  private getLocalizedMuseumDescription(museum: Museum): string {
    const currentLanguage = i18nService.getLanguage();
    if (currentLanguage === 'it') {
      return museum.description || __('Nessuna descrizione');
    }

    return (
      museum.descriptionTranslations?.[currentLanguage]?.trim() ||
      museum.description ||
      __('Nessuna descrizione')
    );
  }

  // ─── Configurazione tabella ─────────────────────────────────
  private get columns(): TableColumn[] {
    return [
      {
        key: 'name',
        label: __('Museo'),
        width: '40%',
        render: (_, row) => {
          const museum = row as unknown as Museum;
          const imageUrl = museum.coverImage || (museum.images && museum.images[0]);
          const museumName = this.getLocalizedMuseumName(museum);
          const museumDescription = this.getLocalizedMuseumDescription(museum);
          const myRoles = this.getMuseumRoles(museum._id);
          return html`
            <div class="flex items-center gap-4 py-2">
              ${this.renderMuseumPreview(imageUrl || '', museumName)}
              <div class="min-w-0 max-w-xs">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-semibold text-surface-900 dark:text-white truncate text-base">
                    ${museumName}
                  </p>
                  ${museum._id === this.currentSelectedMuseumId
                    ? this.renderMuseumTag('selected')
                    : nothing}
                  ${myRoles.includes('manager') ? this.renderMuseumTag('curator') : nothing}
                  ${myRoles.includes('author') ? this.renderMuseumTag('author') : nothing}
                </div>
                <p
                  class="text-sm text-surface-500 dark:text-surface-400 line-clamp-2 max-w-[300px]"
                >
                  ${museumDescription}
                </p>
              </div>
            </div>
          `;
        },
      },
      {
        key: 'stats',
        label: __('Statistiche'),
        width: '20%',
        render: (_, row) => {
          const museum = row as unknown as Museum;
          const stats = this.museumStats.get(museum._id);
          if (this.loadingStats && !stats) {
            return html`<span class="text-sm text-surface-400">${__('Caricamento...')}</span>`;
          }
          if (!stats) {
            return html`<span class="text-sm text-surface-400">-</span>`;
          }
          return html`
            <div class="flex flex-col gap-1 text-sm">
              ${this.renderMuseumStatLine('image', `${stats.artworks} ${__('Opere')}`)}
              ${this.renderMuseumStatLine('text', `${stats.items} ${__('Contenuti')}`)}
              ${this.renderMuseumStatLine('visit', `${stats.visits} ${__('Visite')}`)}
            </div>
          `;
        },
      },
      {
        key: 'city',
        label: __('Città'),
        width: '15%',
        render: (_, row) =>
          this.renderLocationCell(this.getMuseumCity(row as unknown as Museum), true),
      },
      {
        key: 'country',
        label: __('Nazione'),
        width: '15%',
        render: (_, row) =>
          this.renderLocationCell(this.getMuseumCountry(row as unknown as Museum)),
      },
      {
        key: 'actions',
        label: '',
        width: '150px',
        align: 'right' as const,
        render: (_, row) => html`
          ${(row as unknown as Museum)._id !== this.currentSelectedMuseumId
            ? html`<ui-button
                variant="primary"
                size="sm"
                icon="check"
                .label=${__('Seleziona')}
                @click=${(e: Event) => {
                  e.stopPropagation();
                  this.selectMuseum(row as unknown as Museum);
                }}
              ></ui-button>`
            : nothing}
        `,
      },
    ];
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadMuseums();
    this.currentSelectedMuseumId = preferencesService.getSelectedMuseum()?._id || '';
  }

  // ─── Caricamento dati ────────────────────────────────────────
  private async loadMuseums() {
    this.loading = true;
    this.error = '';

    try {
      this.museums = await museumService.getMuseums();
      // Carica le statistiche in background
      this.loadMuseumStats();
    } catch (e) {
      console.error('Error loading museums:', e);
      this.error = __('Impossibile caricare i musei');
    } finally {
      this.loading = false;
    }
  }

  private async loadMuseumStats() {
    this.loadingStats = true;

    // Carica le statistiche di ogni museo in parallelo (a lotti, per non fare troppe richieste)
    const batchSize = 5;
    for (let i = 0; i < this.museums.length; i += batchSize) {
      const batch = this.museums.slice(i, i + batchSize);
      await Promise.all(batch.map((museum) => this.loadStatsForMuseum(museum)));
      // Forza un re-render dopo ogni lotto
      this.requestUpdate();
    }

    this.loadingStats = false;
  }

  private async loadStatsForMuseum(museum: Museum) {
    try {
      const museumId = museum._id;
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

  // ─── Filtri / azioni ─────────────────────────────────
  private getMuseumRoles(museumId: string): string[] {
    if (!this.user?.roleAssignments) return [];

    return this.user.roleAssignments
      .filter((ra) => ra.resourceType === 'museum' && ra.resourceId === museumId)
      .map((ra) => ra.role);
  }

  private get filteredMuseums(): Museum[] {
    let filtered = this.museums;

    // Filtra per ruolo
    if (this.filterRole !== 'all' && this.user?.roleAssignments) {
      const targetRole = this.filterRole === 'curator' ? 'manager' : 'author';
      const myMuseumIds = this.user.roleAssignments
        .filter((ra) => ra.resourceType === 'museum' && ra.role === targetRole)
        .map((ra) => ra.resourceId);
      filtered = filtered.filter((museum) => myMuseumIds.includes(museum._id));
    }

    // Filtra per ricerca
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (museum) =>
          museum.name.toLowerCase().includes(query) ||
          this.getMuseumCity(museum).toLowerCase().includes(query) ||
          this.getMuseumCountry(museum).toLowerCase().includes(query) ||
          museum.description?.toLowerCase().includes(query),
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
      }),
    );
  }

  private renderRoleFilterButton(role: FilterRole, label: string) {
    const activeClassByRole: Record<FilterRole, string> = {
      all: 'bg-brand-500 text-white',
      curator: 'bg-success-500 text-white',
      author: 'bg-warning-500 text-white',
    };

    const inactiveClasses =
      'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700';

    return html`
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-full transition-colors ${this.filterRole === role
          ? activeClassByRole[role]
          : inactiveClasses}"
        @click=${() => (this.filterRole = role)}
      >
        ${label}
      </button>
    `;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="${this.embedded ? 'space-y-4' : 'space-y-6 animate-fade-in'}">
        <!-- Header -->
        ${this.embedded
          ? nothing
          : html`
              <ui-page-header
                .title=${__('Seleziona museo')}
                .description=${__('Scegli il museo su cui vuoi lavorare')}
              ></ui-page-header>
            `}

        <!-- Search and Filters -->
        <ui-card padding="md">
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1">
              <ui-search-bar
                .placeholder=${__('Cerca museo per nome, città o paese...')}
                .value=${this.searchQuery}
                @search=${this.handleSearch}
                @input=${this.handleSearch}
              ></ui-search-bar>
            </div>
            ${this.user
              ? html`
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm text-surface-500 dark:text-surface-400"
                      >${__('Mostra')}:</span
                    >
                    ${this.renderRoleFilterButton('all', __('Tutti'))}
                    ${this.renderRoleFilterButton('curator', __('I miei (Curatore)'))}
                    ${this.renderRoleFilterButton('author', __('I miei (Autore)'))}
                  </div>
                `
              : nothing}
          </div>
        </ui-card>

        <!-- Content -->
        ${this.loading
          ? html`<ui-loading size="lg" .text=${__('Caricamento musei...')}></ui-loading>`
          : this.error
            ? html`
                <ui-alert
                  variant="danger"
                  .title=${__('Errore')}
                  .message=${this.error}
                  showRetry
                  @retry=${this.loadMuseums}
                ></ui-alert>
              `
            : this.filteredMuseums.length === 0
              ? html`
                  <ui-empty
                    icon="folder"
                    .title=${this.searchQuery ? __('Nessun risultato') : __('Nessun museo')}
                    .description=${this.searchQuery
                      ? __('Nessun museo corrisponde alla ricerca')
                      : __('Non ci sono musei disponibili al momento.')}
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
