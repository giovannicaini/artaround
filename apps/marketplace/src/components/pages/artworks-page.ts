import { html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { MuseumAwareMixin, AppBaseElement } from '../../base';
import type { TableColumn, TableAction } from '../ui/ui-table';
import { artworkService, type ArtworkFilters } from '../../services/artwork.service';
import { uploadService } from '../../services/upload.service';
import {
  ARTWORK_TYPE_OPTIONS_IT,
  ArtworkType,
  getArtworkTypeIcon,
  getArtworkTypeLabel,
  type Artwork,
  type User,
} from '@artaround/shared';
import { getPermissions, type PermissionSet } from '../../services/permissions.service';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-badge';
import '../ui/ui-modal';
import '../ui/ui-image-placeholder';
import '../ui/ui-page-header';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-pagination';
import '../ui/ui-icon-button';
import '../ui/ui-input';
import '../ui/ui-range-slider';
import '../ui/ui-select';
import '../ui/ui-checkbox';
import '../ui/ui-data-grid';
import '../ui/ui-table';
import '../ui/ui-list-controls';
import '../ui/ui-media-card';
import '../ui/ui-museum-required-notice';
import '../ui/ui-panel-section';
import '../items/artwork-creator';
import { __ } from '../../services/i18n.service';

type ViewMode = 'list' | 'create' | 'edit' | 'view';
type ArtworkListLayout = 'grid' | 'table';
type ArtworkSortField = 'title' | 'author' | 'year' | 'updatedAt' | 'artworkType';

@customElement('artworks-page')
export class ArtworksPage extends MuseumAwareMixin(AppBaseElement) {
  @property({ type: Object }) user: User | null = null;
  @property({ type: String }) openingArtworkId = '';
  @property({ type: String }) openingViewMode: ViewMode = 'list';

  @state() private viewMode: ViewMode = 'list';
  @state() private artworks: Artwork[] = [];
  @state() private loading = true;
  @state() private error = '';
  @state() private searchQuery = '';
  @state() private filterAuthor = '';
  @state() private filterMovement = '';
  @state() private filterRoom = '';
  @state() private filterFloor = '';
  @state() private filterYearFrom = '';
  @state() private filterYearTo = '';
  @state() private availableAuthors: string[] = [];
  @state() private availableMovements: string[] = [];
  @state() private availableRooms: string[] = [];
  @state() private availableFloors: string[] = [];
  @state() private availableYearMin: number | null = null;
  @state() private availableYearMax: number | null = null;
  @state() private pagination = {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  };
  @state() private selectedArtwork: Artwork | null = null;
  @state() private deleteModalOpen = false;
  @state() private artworkToDelete: Artwork | null = null;
  @state() private deleting = false;
  @state() private filterType: ArtworkType | '' = '';
  @state() private controlsCollapsed = true;
  @state() private listLayout: ArtworkListLayout = 'grid';
  @state() private sortField: ArtworkSortField = 'title';
  @state() private sortDirection: 'asc' | 'desc' = 'asc';
  @state() private visibleColumns: string[] = [
    'image',
    'title',
    'author',
    'year',
    'artworkType',
    'room',
  ];

  private get artworkTypeFilterOptions() {
    return ARTWORK_TYPE_OPTIONS_IT.map((option) => {
      const icon = getArtworkTypeIcon(option.value);
      const label = __(getArtworkTypeLabel(option.value));
      return {
        ...option,
        label: `${icon} ${label}`,
      };
    });
  }

  private get sortOptions(): Array<{ value: ArtworkSortField; label: string }> {
    return [
      { value: 'title', label: __('Titolo') },
      { value: 'author', label: __('Autore') },
      { value: 'year', label: __('Anno') },
      { value: 'updatedAt', label: __('Aggiornamento') },
      { value: 'artworkType', label: __('Tipo opera') },
    ];
  }

  private get columnOptions(): Array<{ key: string; label: string }> {
    return [
      { key: 'image', label: __('Immagine') },
      { key: 'title', label: __('Titolo') },
      { key: 'author', label: __('Autore') },
      { key: 'year', label: __('Anno') },
      { key: 'artworkType', label: __('Tipo') },
      { key: 'movement', label: __('Movimento') },
      { key: 'room', label: __('Sala') },
      { key: 'floor', label: __('Piano') },
      { key: 'updatedAt', label: __('Aggiornato il') },
    ];
  }

  private get permissions(): PermissionSet {
    return getPermissions(this.user);
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadFilterOptions();
    this.loadArtworks();
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('openingArtworkId') && this.openingArtworkId) {
      this.openArtworkDetail(this.openingArtworkId);
    }
    // Handle opening with a specific viewMode (e.g., from history navigation)
    if (changedProps.has('openingViewMode')) {
      if (this.openingViewMode === 'list') {
        // Returning to list view from history
        this.selectedArtwork = null;
        this.viewMode = 'list';
      } else if (this.openingViewMode === 'view' && this.openingArtworkId && this.selectedArtwork) {
        // Already handled by openArtworkDetail
      } else if (this.openingViewMode === 'edit' && this.selectedArtwork) {
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

  onMuseumChanged(): void {
    this.filterAuthor = '';
    this.filterMovement = '';
    this.filterRoom = '';
    this.filterFloor = '';
    this.filterYearFrom = '';
    this.filterYearTo = '';
    this.pagination.page = 1;
    this.loadFilterOptions();
    this.loadArtworks();
  }

  private parseYearFromText(yearValue?: string): number | null {
    if (!yearValue) return null;
    const match = yearValue.match(/-?\d{1,4}/);
    if (!match) return null;

    const parsed = Number(match[0]);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private getArtworkYearCandidates(artwork: Artwork): number[] {
    const candidates: number[] = [];

    if (typeof artwork.startYear === 'number') {
      candidates.push(artwork.startYear);
    }
    if (typeof artwork.endYear === 'number') {
      candidates.push(artwork.endYear);
    }

    const parsedYear = this.parseYearFromText(artwork.year);
    if (parsedYear !== null) {
      candidates.push(parsedYear);
    }

    return candidates;
  }

  private async loadFilterOptions() {
    if (!this.selectedMuseumId) {
      this.availableRooms = [];
      this.availableFloors = [];
      this.availableYearMin = null;
      this.availableYearMax = null;
      return;
    }

    try {
      const artworks = await artworkService.getArtworksByMuseum(this.selectedMuseumId);

      this.availableRooms = Array.from(
        new Set(
          artworks
            .map((artwork) => artwork.room?.trim())
            .filter((room): room is string => Boolean(room)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'it'));

      this.availableFloors = Array.from(
        new Set(
          artworks
            .map((artwork) => artwork.floor?.trim())
            .filter((floor): floor is string => Boolean(floor)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'it'));

      this.availableAuthors = Array.from(
        new Set(
          artworks
            .map((artwork) => artwork.author?.trim())
            .filter((author): author is string => Boolean(author)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'it'));

      this.availableMovements = Array.from(
        new Set(
          artworks
            .map((artwork) => artwork.movement?.trim())
            .filter((movement): movement is string => Boolean(movement)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'it'));

      const years = artworks.flatMap((artwork) => this.getArtworkYearCandidates(artwork));

      if (years.length > 0) {
        this.availableYearMin = Math.min(...years);
        this.availableYearMax = Math.max(...years);

        if (!this.filterYearFrom) {
          this.filterYearFrom = String(this.availableYearMin);
        }
        if (!this.filterYearTo) {
          this.filterYearTo = String(this.availableYearMax);
        }
      } else {
        this.availableYearMin = null;
        this.availableYearMax = null;
        this.filterYearFrom = '';
        this.filterYearTo = '';
      }
    } catch (e) {
      console.error('Error loading artwork filter options:', e);
      this.availableRooms = [];
      this.availableFloors = [];
      this.availableAuthors = [];
      this.availableMovements = [];
      this.availableYearMin = null;
      this.availableYearMax = null;
    }
  }

  private async loadArtworks() {
    this.loading = true;
    this.error = '';

    try {
      const filters: ArtworkFilters = {
        page: this.pagination.page,
        limit: this.pagination.limit,
        museumId: this.selectedMuseumId || undefined,
      };

      if (this.filterType) {
        filters.artworkType = this.filterType;
      }

      if (this.filterAuthor.trim()) {
        filters.author = this.filterAuthor.trim();
      }

      if (this.filterMovement.trim()) {
        filters.movement = this.filterMovement.trim();
      }

      if (this.filterRoom.trim()) {
        filters.room = this.filterRoom.trim();
      }

      if (this.filterFloor.trim()) {
        filters.floor = this.filterFloor.trim();
      }

      if (this.filterYearFrom.trim()) {
        const yearFrom = Number(this.filterYearFrom.trim());
        if (!Number.isNaN(yearFrom)) {
          filters.yearFrom = yearFrom;
        }
      }

      if (this.filterYearTo.trim()) {
        const yearTo = Number(this.filterYearTo.trim());
        if (!Number.isNaN(yearTo)) {
          filters.yearTo = yearTo;
        }
      }

      if (this.searchQuery.trim()) {
        filters.search = this.searchQuery;
      }

      const result = await artworkService.getArtworks(filters);
      this.artworks = result.artworks;
      this.pagination = result.pagination;
    } catch (e) {
      console.error('Error loading artworks:', e);
      this.error = __('Impossibile caricare le opere');
    } finally {
      this.loading = false;
    }
  }

  private async openArtworkDetail(artworkId: string) {
    if (!artworkId) return;

    try {
      const artwork = await artworkService.getArtwork(artworkId);
      if (!artwork) return;

      this.selectedArtwork = artwork;
      this.viewMode = 'view';
      this.emitStateChange();
    } catch (e) {
      console.error('Error opening artwork detail:', e);
    }
  }

  private async handleSearch(e?: CustomEvent<{ value?: string }>) {
    if (e?.detail?.value !== undefined) {
      this.searchQuery = e.detail.value;
    }
    this.pagination.page = 1;
    this.loadArtworks();
  }

  private handleResetFilters() {
    this.searchQuery = '';
    this.filterType = '';
    this.filterAuthor = '';
    this.filterMovement = '';
    this.filterRoom = '';
    this.filterFloor = '';
    this.filterYearFrom = this.availableYearMin !== null ? String(this.availableYearMin) : '';
    this.filterYearTo = this.availableYearMax !== null ? String(this.availableYearMax) : '';
    this.pagination.page = 1;
    this.loadArtworks();
  }

  private handleViewArtwork(artwork: Artwork) {
    this.selectedArtwork = artwork;
    this.viewMode = 'view';
    this.emitStateChange();
  }

  private handleEditArtwork(artwork: Artwork) {
    if (!this.permissions.canEditArtwork) {
      this.error = __(
        'Non hai i permessi per modificare le opere. Ruolo richiesto: admin o curator.',
      );
      return;
    }
    this.selectedArtwork = artwork;
    this.viewMode = 'edit';
    this.emitStateChange();
  }

  private handleDeleteArtwork(artwork: Artwork) {
    if (!this.permissions.canDeleteArtwork) {
      this.error = __('Non hai i permessi per eliminare le opere. Ruolo richiesto: admin.');
      return;
    }
    this.artworkToDelete = artwork;
    this.deleteModalOpen = true;
  }

  private async handleConfirmDelete() {
    if (!this.artworkToDelete) return;

    this.deleting = true;
    try {
      await artworkService.deleteArtwork(this.artworkToDelete._id);
      this.deleteModalOpen = false;
      this.artworkToDelete = null;
      this.loadArtworks();
    } catch (e) {
      console.error('Error deleting artwork:', e);
    } finally {
      this.deleting = false;
    }
  }

  private handleCancelDelete() {
    this.deleteModalOpen = false;
    this.artworkToDelete = null;
  }

  private handlePageChange(page: number) {
    this.pagination.page = page;
    this.loadArtworks();
  }

  private getArtworkImageAttrs(imagePath: string, sizes: string) {
    return uploadService.getResponsiveImageAttrs(imagePath, {
      widths: [480, 768, 1200],
      sizes,
    });
  }

  private get activeFilterCount(): number {
    const values = [
      this.searchQuery,
      this.filterType,
      this.filterAuthor,
      this.filterMovement,
      this.filterRoom,
      this.filterFloor,
    ];
    const activeCore = values.filter((value) => Boolean(value && String(value).trim())).length;

    const yearChanged =
      (this.availableYearMin !== null && this.filterYearFrom !== String(this.availableYearMin)) ||
      (this.availableYearMax !== null && this.filterYearTo !== String(this.availableYearMax));

    return activeCore + (yearChanged ? 1 : 0);
  }

  private get normalizedArtworks(): Artwork[] {
    const items = [...this.artworks];
    const directionMultiplier = this.sortDirection === 'asc' ? 1 : -1;

    return items.sort((left, right) => {
      const compareString = (a?: string, b?: string) =>
        (a || '').localeCompare(b || '', 'it', { sensitivity: 'base' });

      const compareNumber = (a?: number | null, b?: number | null) => {
        const leftValue = typeof a === 'number' ? a : Number.NEGATIVE_INFINITY;
        const rightValue = typeof b === 'number' ? b : Number.NEGATIVE_INFINITY;
        if (leftValue === rightValue) return 0;
        return leftValue > rightValue ? 1 : -1;
      };

      let result = 0;
      if (this.sortField === 'title') {
        result = compareString(left.title, right.title);
      } else if (this.sortField === 'author') {
        result = compareString(left.author, right.author);
      } else if (this.sortField === 'artworkType') {
        result = compareString(left.artworkType, right.artworkType);
      } else if (this.sortField === 'updatedAt') {
        result = compareNumber(
          left.updatedAt ? new Date(left.updatedAt).getTime() : null,
          right.updatedAt ? new Date(right.updatedAt).getTime() : null,
        );
      } else {
        const leftYear = this.getArtworkYearCandidates(left)[0] ?? null;
        const rightYear = this.getArtworkYearCandidates(right)[0] ?? null;
        result = compareNumber(leftYear, rightYear);
      }

      if (result === 0) {
        result = compareString(left.title, right.title);
      }

      return result * directionMultiplier;
    });
  }

  private handleToggleColumn(columnKey: string, visible: boolean) {
    if (!visible && this.visibleColumns.length <= 1) {
      return;
    }

    if (visible) {
      this.visibleColumns = [...new Set([...this.visibleColumns, columnKey])];
      return;
    }

    this.visibleColumns = this.visibleColumns.filter((key) => key !== columnKey);
  }

  private hasVisibleColumn(columnKey: string): boolean {
    return this.visibleColumns.includes(columnKey);
  }

  private buildArtworkTableColumns(): TableColumn[] {
    const columns: TableColumn[] = [];

    if (this.hasVisibleColumn('image')) {
      columns.push({
        key: 'image',
        label: '',
        width: '72px',
        render: (_value, row) => {
          const artwork = row.__artwork as Artwork;
          return artwork.image
            ? html`<img
                src="${artwork.image}"
                alt="${artwork.title}"
                class="min-w-12 min-h-12 w-12 h-12 object-cover rounded flex-shrink-0"
              />`
            : html`<div
                class="min-w-12 min-h-12 w-12 h-12 bg-surface-100 dark:bg-surface-700 rounded flex items-center justify-center flex-shrink-0"
              >
                <ui-icon name="image" size="sm" class="text-surface-400"></ui-icon>
              </div>`;
        },
      });
    }

    if (this.hasVisibleColumn('title')) {
      columns.push({
        key: 'title',
        label: __('Titolo'),
        sortable: true,
        render: (_value, row) => {
          const artwork = row.__artwork as Artwork;
          return html`<span class="font-medium">${artwork.title}</span>`;
        },
      });
    }

    if (this.hasVisibleColumn('author')) {
      columns.push({ key: 'author', label: __('Autore'), sortable: true });
    }
    if (this.hasVisibleColumn('year')) {
      columns.push({ key: 'year', label: __('Anno'), width: '120px', sortable: true });
    }
    if (this.hasVisibleColumn('artworkType')) {
      columns.push({
        key: 'artworkType',
        label: __('Tipo'),
        sortable: true,
        render: (_value, row) => {
          const artwork = row.__artwork as Artwork;
          return html`
            <ui-badge
              variant="secondary"
              size="sm"
              .label=${`${getArtworkTypeIcon(artwork.artworkType)} ${getArtworkTypeLabel(artwork.artworkType)}`}
            ></ui-badge>
          `;
        },
      });
    }
    if (this.hasVisibleColumn('movement')) {
      columns.push({ key: 'movement', label: __('Movimento') });
    }
    if (this.hasVisibleColumn('room')) {
      columns.push({ key: 'room', label: __('Sala'), width: '110px' });
    }
    if (this.hasVisibleColumn('floor')) {
      columns.push({ key: 'floor', label: __('Piano'), width: '90px' });
    }
    if (this.hasVisibleColumn('updatedAt')) {
      columns.push({
        key: 'updatedAtLabel',
        label: __('Aggiornato il'),
        width: '180px',
        sortable: true,
      });
    }

    return columns;
  }

  private buildArtworkTableRows(items: Artwork[]): Record<string, unknown>[] {
    return items.map((artwork) => ({
      title: artwork.title,
      author: artwork.author || 'Autore sconosciuto',
      year: artwork.year || '—',
      artworkType: artwork.artworkType,
      movement: artwork.movement || '—',
      room: artwork.room || '—',
      floor: artwork.floor || '—',
      updatedAtLabel: this.formatDateTime(artwork.updatedAt as unknown as string) || '—',
      __artwork: artwork,
    }));
  }

  private buildArtworkTableActions(): TableAction[] {
    const actions: TableAction[] = [{ icon: 'eye', label: __('Visualizza'), action: 'view' }];

    if (this.permissions.canEditArtwork) {
      actions.push({ icon: 'edit', label: __('Modifica'), action: 'edit' });
    }
    if (this.permissions.canDeleteArtwork) {
      actions.push({
        icon: 'trash',
        label: __('Elimina'),
        action: 'delete',
        variant: 'danger',
      });
    }

    return actions;
  }

  private get tableSortKey(): string {
    if (this.sortField === 'updatedAt') return 'updatedAtLabel';
    return this.sortField;
  }

  private mapTableSortKeyToSortField(key: string): ArtworkSortField | null {
    const map: Record<string, ArtworkSortField> = {
      title: 'title',
      author: 'author',
      year: 'year',
      artworkType: 'artworkType',
      updatedAtLabel: 'updatedAt',
    };
    return map[key] ?? null;
  }

  private handleTableSortChange(e: CustomEvent<{ key: string; direction: 'asc' | 'desc' }>): void {
    const sortField = this.mapTableSortKeyToSortField(e.detail.key);
    if (!sortField) return;

    this.sortField = sortField;
    this.sortDirection = e.detail.direction;
  }

  private handleArtworkTableAction(
    e: CustomEvent<{ action: string; row: Record<string, unknown> }>,
  ) {
    const artwork = e.detail.row.__artwork as Artwork | undefined;
    if (!artwork) return;

    if (e.detail.action === 'view') {
      this.handleViewArtwork(artwork);
    } else if (e.detail.action === 'edit') {
      this.handleEditArtwork(artwork);
    } else if (e.detail.action === 'delete') {
      this.handleDeleteArtwork(artwork);
    }
  }

  private renderTable(items: Artwork[]) {
    return html`
      <ui-table
        .columns=${this.buildArtworkTableColumns()}
        .data=${this.buildArtworkTableRows(items)}
        .actions=${this.buildArtworkTableActions()}
        .sortKey=${this.tableSortKey}
        .sortDir=${this.sortDirection}
        .externalSort=${true}
        clickable
        compact
        striped
        @sort-change=${this.handleTableSortChange}
        @row-click=${(e: CustomEvent<{ row: Record<string, unknown> }>) => {
          const artwork = e.detail.row.__artwork as Artwork | undefined;
          if (artwork) {
            this.handleViewArtwork(artwork);
          }
        }}
        @row-action=${this.handleArtworkTableAction}
      ></ui-table>
    `;
  }

  private renderControlsSummary() {
    return html`
      <ui-badge
        variant=${this.activeFilterCount > 0 ? 'primary' : 'secondary'}
        .label=${`${this.activeFilterCount} ${__('filtri')}`}
      ></ui-badge>
    `;
  }

  private renderControlsContent(
    authorOptions: Array<{ value: string; label: string }>,
    movementOptions: Array<{ value: string; label: string }>,
    roomOptions: Array<{ value: string; label: string }>,
    floorOptions: Array<{ value: string; label: string }>,
    yearRangeReady: boolean,
    minYear: number,
    maxYear: number,
    yearFromValue: number,
    yearToValue: number,
  ) {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ui-select
          .label=${__('Ordina per')}
          .value=${this.sortField}
          .options=${this.sortOptions}
          @select-change=${(e: CustomEvent<{ value: ArtworkSortField }>) =>
            (this.sortField = e.detail.value)}
        ></ui-select>

        <ui-select
          .label=${__('Direzione')}
          .value=${this.sortDirection}
          .options=${[
            { value: 'asc', label: __('Crescente') },
            { value: 'desc', label: __('Decrescente') },
          ]}
          @select-change=${(e: CustomEvent<{ value: 'asc' | 'desc' }>) =>
            (this.sortDirection = e.detail.value)}
        ></ui-select>

        <div class="md:col-span-2">
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
            ${__('Vista')}
          </p>
          <div class="flex items-center gap-2">
            <ui-button
              size="xs"
              .variant=${this.listLayout === 'grid' ? 'primary' : 'secondary'}
              .label=${__('Griglia')}
              @click=${() => (this.listLayout = 'grid')}
            ></ui-button>
            <ui-button
              size="xs"
              .variant=${this.listLayout === 'table' ? 'primary' : 'secondary'}
              .label=${__('Tabella')}
              @click=${() => (this.listLayout = 'table')}
            ></ui-button>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium text-surface-700 dark:text-surface-300">
          ${__('Campi visibili')}
        </p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          ${this.columnOptions.map(
            (column) => html`
              <label class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                <ui-checkbox
                  .checked=${this.visibleColumns.includes(column.key)}
                  @checkbox-change=${(e: CustomEvent<{ checked: boolean }>) =>
                    this.handleToggleColumn(column.key, e.detail.checked)}
                ></ui-checkbox>
                <span>${column.label}</span>
              </label>
            `,
          )}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ui-input
          .label=${__('Ricerca')}
          .placeholder=${__('Titolo, autore, anno...')}
          .value=${this.searchQuery}
          @input-change=${(e: CustomEvent<{ value: string }>) => {
            this.searchQuery = e.detail.value;
          }}
        ></ui-input>

        <ui-select
          .label=${__('Tipo opera')}
          .placeholder=${__('Tutti i tipi')}
          clearable
          .value=${this.filterType}
          .options=${this.artworkTypeFilterOptions}
          @select-change=${(e: CustomEvent<{ value: ArtworkType | '' }>) => {
            this.filterType = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Autore')}
          .placeholder=${__('Tutti gli autori')}
          clearable
          .value=${this.filterAuthor}
          .options=${authorOptions}
          @select-change=${(e: CustomEvent<{ value: string }>) => {
            this.filterAuthor = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Movimento')}
          .placeholder=${__('Tutti i movimenti')}
          clearable
          .value=${this.filterMovement}
          .options=${movementOptions}
          @select-change=${(e: CustomEvent<{ value: string }>) => {
            this.filterMovement = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Sala')}
          .placeholder=${__('Tutte le sale')}
          clearable
          .value=${this.filterRoom}
          .options=${roomOptions}
          @select-change=${(e: CustomEvent<{ value: string }>) => {
            this.filterRoom = e.detail.value;
          }}
        ></ui-select>

        <ui-select
          .label=${__('Piano')}
          .placeholder=${__('Tutti i piani')}
          clearable
          .value=${this.filterFloor}
          .options=${floorOptions}
          @select-change=${(e: CustomEvent<{ value: string }>) => {
            this.filterFloor = e.detail.value;
          }}
        ></ui-select>
      </div>

      <div class="space-y-2">
        ${yearRangeReady
          ? html`
              <ui-range-slider
                .label=${__('Intervallo anni')}
                .min=${minYear}
                .max=${maxYear}
                .from=${yearFromValue}
                .to=${yearToValue}
                @range-change=${(e: CustomEvent<{ from: number; to: number }>) => {
                  this.filterYearFrom = String(e.detail.from);
                  this.filterYearTo = String(e.detail.to);
                }}
              ></ui-range-slider>
            `
          : html`
              <p class="text-xs text-surface-500 dark:text-surface-400">
                ${__('Nessun anno numerico disponibile per il museo selezionato')}
              </p>
            `}
      </div>

      <div class="flex items-center gap-2">
        <ui-button
          variant="primary"
          size="sm"
          icon="search"
          .label=${__('Applica filtri')}
          @click=${() => this.handleSearch()}
        ></ui-button>
        <ui-button
          variant="secondary"
          size="sm"
          .label=${__('Reset')}
          @click=${this.handleResetFilters}
        ></ui-button>
      </div>
    `;
  }

  private formatDateTime(value?: Date | string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('it-IT');
  }

  private renderDetailField(label: string, value?: string | number | null, fullWidth = false) {
    if (value === undefined || value === null || value === '') return '';

    return html`
      <div class="${fullWidth ? 'md:col-span-2' : ''}">
        <dt class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider">
          ${label}
        </dt>
        <dd class="text-sm font-medium text-surface-900 dark:text-white mt-1">${value}</dd>
      </div>
    `;
  }

  private renderWikidataField(label: string, wikidataId?: string | null) {
    if (!wikidataId) return '';

    return html`
      <div>
        <dt class="text-xs text-surface-500 dark:text-surface-400 uppercase tracking-wider">
          ${label}
        </dt>
        <dd class="text-sm font-medium mt-1">
          <a
            href="https://www.wikidata.org/wiki/${wikidataId}"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-brand-600 dark:text-brand-400 hover:underline"
          >
            ${wikidataId}
            <ui-icon name="link" size="xs"></ui-icon>
          </a>
        </dd>
      </div>
    `;
  }

  private renderTagList(title: string, items?: string[]) {
    if (!items || items.length === 0) return '';

    return html`
      <div class="mb-4">
        <p class="text-xs uppercase tracking-wider text-surface-500 mb-2">${title}</p>
        <div class="flex flex-wrap gap-2">
          ${items.map((item) => html` <ui-badge variant="secondary" .label=${item}></ui-badge> `)}
        </div>
      </div>
    `;
  }

  private renderListView() {
    const authorOptions = this.availableAuthors.map((author) => ({ value: author, label: author }));
    const movementOptions = this.availableMovements.map((movement) => ({
      value: movement,
      label: movement,
    }));
    const roomOptions = this.availableRooms.map((room) => ({ value: room, label: room }));
    const floorOptions = this.availableFloors.map((floor) => ({ value: floor, label: floor }));
    const yearRangeReady = this.availableYearMin !== null && this.availableYearMax !== null;
    const minYear = this.availableYearMin ?? 0;
    const maxYear = this.availableYearMax ?? 0;
    const yearFromValue = Number(this.filterYearFrom || minYear);
    const yearToValue = Number(this.filterYearTo || maxYear);

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          .title=${__('Gestione Opere')}
          .description=${__('Collegate tramite Wikidata')}
          .count=${this.pagination.total}
          .countLabel=${__('opere fisiche nei musei')}
        >
          <div slot="actions" class="flex items-center gap-3">
            ${this.permissions.canCreateArtwork
              ? html`
                  <ui-button
                    variant="primary"
                    icon="plus"
                    .label=${__('Nuova Opera')}
                    @click=${this.handleGoToCreate}
                  ></ui-button>
                `
              : nothing}
          </div>
        </ui-page-header>

        ${!this.selectedMuseumId
          ? html`<ui-museum-required-notice
              subject="opere"
              @select-museum=${this.emitSelectMuseum}
            ></ui-museum-required-notice>`
          : nothing}

        <!-- Controls -->
        <ui-list-controls
          .title=${__('Filtri e visualizzazione')}
          .description=${__('Espandi per filtrare, ordinare e cambiare layout')}
          .collapsed=${this.controlsCollapsed}
          .renderSummary=${() => this.renderControlsSummary()}
          .renderContent=${() =>
            this.renderControlsContent(
              authorOptions,
              movementOptions,
              roomOptions,
              floorOptions,
              yearRangeReady,
              minYear,
              maxYear,
              yearFromValue,
              yearToValue,
            )}
          @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
            (this.controlsCollapsed = e.detail.collapsed)}
        ></ui-list-controls>

        <!-- Content -->
        ${this.loading
          ? this.renderLoading()
          : this.error
            ? this.renderError()
            : this.artworks.length === 0
              ? this.renderEmpty()
              : this.listLayout === 'grid'
                ? this.renderGrid(this.normalizedArtworks)
                : this.renderTable(this.normalizedArtworks)}

        <!-- Pagination -->
        ${this.pagination.totalPages > 1 ? this.renderPagination() : nothing}
      </div>
    `;
  }

  private renderCreateView() {
    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          .title=${__('Nuova Opera')}
          .description=${__("Aggiungi un'opera fisica al catalogo")}
          showBack
          @back=${this.handleBackToList}
        ></ui-page-header>

        <!-- Form -->
        <artwork-creator
          @artwork-created=${() => {
            this.handleBackToList();
            this.loadArtworks();
          }}
          @cancel=${this.handleBackToList}
        ></artwork-creator>
      </div>
    `;
  }

  private renderLoading() {
    return html`<ui-loading .text=${__('Caricamento opere...')}></ui-loading>`;
  }

  private renderError() {
    return html`
      <ui-alert
        variant="danger"
        .title=${__('Errore')}
        .message=${this.error}
        showRetry
        @retry=${this.loadArtworks}
      ></ui-alert>
    `;
  }

  private renderEmpty() {
    return html`
      <ui-empty
        icon="image"
        .title=${__('Nessuna opera')}
        .description=${this.searchQuery
          ? __('Nessun risultato per la ricerca')
          : __('Non ci sono ancora opere')}
      >
        ${this.permissions.canCreateArtwork && !this.searchQuery
          ? html`
              <ui-button
                slot="action"
                variant="primary"
                icon="plus"
                .label=${__('Aggiungi la prima opera')}
                @click=${this.handleGoToCreate}
              ></ui-button>
            `
          : nothing}
      </ui-empty>
    `;
  }

  private renderPagination() {
    return html`
      <ui-pagination
        .page=${this.pagination.page}
        .totalPages=${this.pagination.totalPages}
        @page-change=${(e: CustomEvent) => this.handlePageChange(e.detail.page)}
      ></ui-pagination>
    `;
  }

  private renderGrid(items: Artwork[]) {
    return html`
      <ui-data-grid
        .items=${items}
        .columns=${3}
        .renderItem=${(artwork: Artwork) => this.renderArtworkCard(artwork)}
      ></ui-data-grid>
    `;
  }

  private renderArtworkCard(artwork: Artwork) {
    const imageAttrs = artwork.image
      ? this.getArtworkImageAttrs(artwork.image, '(max-width: 1024px) 50vw, 33vw')
      : null;

    return html`
      <ui-media-card
        .imageSrc=${imageAttrs?.src || ''}
        .imageSrcset=${imageAttrs?.srcset || ''}
        .imageSizes=${imageAttrs?.sizes || ''}
        .imageAlt=${artwork.title}
        aspectClass="aspect-[4/3]"
        placeholderType="artwork"
        placeholderSize="lg"
        bodyClass="p-3"
        .renderTopLeft=${artwork.wikidataId
          ? () =>
              html`<ui-badge variant="primary" size="sm" .label=${artwork.wikidataId}></ui-badge>`
          : null}
        .renderTopRight=${() =>
          html`<ui-badge
            variant="secondary"
            size="sm"
            .label=${`${getArtworkTypeIcon(artwork.artworkType)} ${getArtworkTypeLabel(artwork.artworkType)}`}
          ></ui-badge>`}
        .renderContent=${() => html`
          <h3 class="font-semibold text-surface-900 dark:text-white mb-1 line-clamp-2">
            ${artwork.title}
          </h3>

          ${this.hasVisibleColumn('author') || this.hasVisibleColumn('year')
            ? html`
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-2">
                  ${this.hasVisibleColumn('author')
                    ? (artwork.author ?? 'Autore sconosciuto')
                    : nothing}
                  ${this.hasVisibleColumn('year') && artwork.year
                    ? html`<span class="text-surface-400">• ${artwork.year}</span>`
                    : nothing}
                </p>
              `
            : nothing}

          <div class="flex flex-wrap gap-1 mb-2">
            ${this.hasVisibleColumn('movement') && artwork.movement
              ? html`
                  <ui-badge variant="secondary" size="sm" .label=${artwork.movement}></ui-badge>
                `
              : nothing}
            ${this.hasVisibleColumn('room') && artwork.room
              ? html`
                  <ui-badge
                    variant="secondary"
                    size="sm"
                    icon="location"
                    .label=${artwork.room}
                  ></ui-badge>
                `
              : nothing}
            ${this.hasVisibleColumn('floor') && artwork.floor
              ? html`
                  <ui-badge
                    variant="secondary"
                    size="sm"
                    icon="layers"
                    .label=${artwork.floor}
                  ></ui-badge>
                `
              : nothing}
          </div>

          ${artwork.materials && artwork.materials.length > 0
            ? html`
                <p class="text-xs text-surface-500 dark:text-surface-400 mb-2 line-clamp-1">
                  ${artwork.materials.join(', ')}
                </p>
              `
            : nothing}

          <div
            class="flex items-center justify-between pt-3 border-t border-surface-100 dark:border-surface-800"
          >
            <ui-button
              variant="ghost"
              size="xs"
              .label=${`${__('Vedi contenuti')} →`}
              @click=${() => this.handleViewArtworkContents(artwork)}
            ></ui-button>

            <div class="flex items-center gap-1">
              <ui-icon-button
                icon="eye"
                title=${__('Visualizza')}
                @click=${() => this.handleViewArtwork(artwork)}
              ></ui-icon-button>
              ${this.permissions.canEditArtwork
                ? html`
                    <ui-icon-button
                      icon="edit"
                      .title=${__('Modifica')}
                      @click=${() => this.handleEditArtwork(artwork)}
                    ></ui-icon-button>
                  `
                : nothing}
              ${this.permissions.canDeleteArtwork
                ? html`
                    <ui-icon-button
                      icon="trash"
                      variant="danger"
                      .title=${__('Elimina')}
                      @click=${() => this.handleDeleteArtwork(artwork)}
                    ></ui-icon-button>
                  `
                : nothing}
            </div>
          </div>
        `}
      ></ui-media-card>
    `;
  }

  private handleViewArtworkContents(artwork: Artwork) {
    // Dispatch event to navigate to contents filtered by this artwork
    this.dispatchEvent(
      new CustomEvent('navigate-to-contents', {
        detail: { artworkId: artwork.wikidataId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private renderViewMode() {
    if (!this.selectedArtwork) return this.renderListView();

    const createdAt = this.formatDateTime(this.selectedArtwork.createdAt as unknown as string);
    const updatedAt = this.formatDateTime(this.selectedArtwork.updatedAt as unknown as string);

    const selectedImageAttrs = this.selectedArtwork.image
      ? this.getArtworkImageAttrs(this.selectedArtwork.image, '(max-width: 1024px) 100vw, 33vw')
      : null;

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          .title=${this.selectedArtwork.title}
          .description=${`${this.selectedArtwork.author || __('Autore sconosciuto')}${this.selectedArtwork.year ? ` • ${this.selectedArtwork.year}` : ''}`}
          showBack
          @back=${this.handleBackToList}
        >
          ${this.permissions.canEditArtwork
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
            <ui-card>
              <div
                class="aspect-square bg-surface-100 dark:bg-surface-800 rounded-lg overflow-hidden"
              >
                ${this.selectedArtwork.image
                  ? html`
                      <img
                        src="${selectedImageAttrs?.src}"
                        srcset="${ifDefined(selectedImageAttrs?.srcset)}"
                        sizes="${ifDefined(selectedImageAttrs?.sizes)}"
                        alt="${this.selectedArtwork.title}"
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
                        type="artwork"
                        size="full"
                        hidden
                        class="absolute inset-0"
                      ></ui-image-placeholder>
                    `
                  : html`
                      <ui-image-placeholder type="artwork" size="full"></ui-image-placeholder>
                    `}
              </div>

              <!-- Wikidata link -->
              ${this.selectedArtwork.wikidataId
                ? html`
                    <a
                      href="https://www.wikidata.org/wiki/${this.selectedArtwork.wikidataId}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-sm"
                    >
                      <ui-icon name="link" size="xs"></ui-icon>
                      Vedi su Wikidata (${this.selectedArtwork.wikidataId})
                    </a>
                  `
                : nothing}
            </ui-card>
          </div>

          <!-- Details -->
          <div class="lg:col-span-2 space-y-6">
            <!-- Overview -->
            <ui-panel-section
              .title=${__('Panoramica')}
              icon="grid"
              .renderContent=${() => html`
                <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${this.renderDetailField('Titolo', this.selectedArtwork!.title, true)}
                  ${this.renderDetailField('Autore', this.selectedArtwork!.author)}
                  ${this.renderDetailField('Anno / Periodo', this.selectedArtwork!.year)}
                  ${this.renderDetailField(
                    'Tipo',
                    `${getArtworkTypeIcon(this.selectedArtwork!.artworkType)} ${getArtworkTypeLabel(this.selectedArtwork!.artworkType)}`,
                  )}
                  ${this.renderDetailField('Sala', this.selectedArtwork!.room)}
                  ${this.renderDetailField('Piano', this.selectedArtwork!.floor)}
                </dl>
              `}
            ></ui-panel-section>

            <ui-panel-section
              .title=${__('Identificativi')}
              icon="hash"
              .renderContent=${() => html`
                <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${this.renderWikidataField('ID Wikidata', this.selectedArtwork!.wikidataId)}
                  ${this.renderWikidataField('ID Museo', this.selectedArtwork!.museumId)}
                  ${this.renderWikidataField(
                    'ID Autore Wikidata',
                    this.selectedArtwork!.authorWikidataId,
                  )}
                  ${this.renderWikidataField(
                    'ID Movimento Wikidata',
                    this.selectedArtwork!.movementWikidataId,
                  )}
                  ${this.renderWikidataField(
                    'ID Stile Wikidata',
                    this.selectedArtwork!.styleWikidataId,
                  )}
                  ${this.renderWikidataField(
                    'ID Periodo Wikidata',
                    this.selectedArtwork!.periodWikidataId,
                  )}
                </dl>
              `}
            ></ui-panel-section>

            <ui-panel-section
              .title=${__('Classificazione e Tecnica')}
              icon="tag"
              .renderContent=${() => html`
                <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  ${this.renderDetailField('Movimento', this.selectedArtwork!.movement)}
                  ${this.renderDetailField('Stile', this.selectedArtwork!.style)}
                  ${this.renderDetailField('Periodo', this.selectedArtwork!.period)}
                  ${this.renderDetailField('Tecnica', this.selectedArtwork!.technique)}
                  ${this.renderDetailField(
                    'Dimensioni',
                    this.selectedArtwork!.dimensions?.displayText,
                  )}
                </dl>
              `}
            ></ui-panel-section>

            <!-- Materials -->
            ${(this.selectedArtwork.materials && this.selectedArtwork.materials.length > 0) ||
            (this.selectedArtwork.subjects && this.selectedArtwork.subjects.length > 0) ||
            (this.selectedArtwork.historicalEvents &&
              this.selectedArtwork.historicalEvents.length > 0) ||
            this.selectedArtwork.artworkCollection
              ? html`
                  <ui-panel-section
                    .title=${__('Contesto')}
                    icon="layers"
                    .renderContent=${() => html`
                      ${this.renderTagList('Materiali', this.selectedArtwork!.materials)}
                      ${this.renderTagList('Soggetti', this.selectedArtwork!.subjects)}
                      ${this.renderTagList(
                        'Eventi storici',
                        this.selectedArtwork!.historicalEvents,
                      )}
                      ${this.selectedArtwork!.artworkCollection
                        ? html`
                            <p class="text-sm text-surface-600 dark:text-surface-400">
                              <span class="font-medium">Collezione:</span>
                              ${this.selectedArtwork!.artworkCollection}
                            </p>
                          `
                        : nothing}
                    `}
                  ></ui-panel-section>
                `
              : nothing}

            <!-- Additional Images -->
            ${this.selectedArtwork.images && this.selectedArtwork.images.length > 0
              ? html`
                  <ui-panel-section
                    .title=${__('Immagini aggiuntive')}
                    icon="image"
                    .renderContent=${() => html`
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        ${this.selectedArtwork!.images!.map((imagePath) => {
                          const imageAttrs = this.getArtworkImageAttrs(
                            imagePath,
                            '(max-width: 768px) 50vw, 33vw',
                          );

                          return html`
                            <div
                              class="aspect-square rounded-lg overflow-hidden bg-surface-100 dark:bg-surface-800"
                            >
                              <img
                                src="${imageAttrs.src}"
                                srcset="${ifDefined(imageAttrs.srcset)}"
                                sizes="${ifDefined(imageAttrs.sizes)}"
                                alt="Immagine aggiuntiva"
                                class="w-full h-full object-cover"
                              />
                            </div>
                          `;
                        })}
                      </div>
                    `}
                  ></ui-panel-section>
                `
              : nothing}

            <!-- Map Position -->
            ${this.selectedArtwork.mapPosition
              ? html`
                  <ui-panel-section
                    .title=${__('Posizione Mappa')}
                    icon="location"
                    .renderContent=${() => html`
                      <dl class="grid grid-cols-2 gap-4">
                        ${this.renderDetailField(
                          'Floor ID',
                          this.selectedArtwork!.mapPosition!.floorId,
                        )}
                        ${this.renderDetailField('X', this.selectedArtwork!.mapPosition!.x)}
                        ${this.renderDetailField('Y', this.selectedArtwork!.mapPosition!.y)}
                        ${this.selectedArtwork!.mapPosition!.rotation !== undefined
                          ? this.renderDetailField(
                              'Rotazione',
                              `${this.selectedArtwork!.mapPosition!.rotation}°`,
                            )
                          : nothing}
                      </dl>
                    `}
                  ></ui-panel-section>
                `
              : nothing}

            <!-- Metadata -->
            ${createdAt || updatedAt || this.selectedArtwork._id
              ? html`
                  <ui-panel-section
                    .title=${__('Metadati')}
                    icon="clock"
                    .renderContent=${() => html`
                      <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        ${this.renderDetailField('ID interno', this.selectedArtwork!._id)}
                        ${this.renderDetailField('Creato il', createdAt)}
                        ${this.renderDetailField('Aggiornato il', updatedAt)}
                      </dl>
                    `}
                  ></ui-panel-section>
                `
              : nothing}

            <!-- Description -->
            ${this.selectedArtwork.description
              ? html`
                  <ui-panel-section
                    .title=${__('Descrizione')}
                    icon="document"
                    .renderContent=${() => html`
                      <p class="text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                        ${this.selectedArtwork!.description}
                      </p>
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
    if (!this.selectedArtwork) return this.renderListView();

    return html`
      <div class="space-y-6">
        <!-- Header -->
        <ui-page-header
          .title=${__('Modifica Opera')}
          .description=${this.selectedArtwork.title}
          showBack
          @back=${this.handleBackToList}
        ></ui-page-header>

        <!-- Edit Form -->
        <artwork-creator
          artworkId="${this.selectedArtwork._id}"
          @artwork-created=${() => {
            this.handleBackToList();
            this.loadArtworks();
          }}
          @cancel=${this.handleBackToList}
        ></artwork-creator>
      </div>
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
        .title=${__('Elimina Opera')}
        .message=${__(
          'Sei sicuro di voler eliminare questa opera? Tutti i contenuti associati rimarranno ma perderanno il riferimento a questa opera.',
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

  /**
   * Emits an event to notify the parent about state changes (viewMode, selected artwork)
   * Used for history management
   */
  private emitStateChange(): void {
    this.dispatchEvent(
      new CustomEvent('page-state-changed', {
        detail: {
          viewMode: this.viewMode,
          artworkId: this.selectedArtwork?._id || '',
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Returns to the list view and clears the selected artwork
   */
  private handleBackToList(): void {
    this.selectedArtwork = null;
    this.viewMode = 'list';
    this.emitStateChange();
  }

  /**
   * Navigates to create mode
   */
  private handleGoToCreate(): void {
    this.viewMode = 'create';
    this.emitStateChange();
  }
}
