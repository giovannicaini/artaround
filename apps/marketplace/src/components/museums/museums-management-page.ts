/* eslint-disable @typescript-eslint/no-unused-vars */
import { LitElement, html, nothing } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { TableColumn, TableAction } from '../ui/ui-table';
import { museumService } from '../../services/museum.service';
import { userService } from '../../services/user.service';
import { uploadService } from '../../services/upload.service';
import type { Museum, User, CreateMuseumData, MuseumCurator } from '@artaround/shared';
import { UserRole, ContextualRole, ResourceType } from '@artaround/shared';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-badge';
import '../ui/ui-modal';
import '../ui/ui-image-placeholder';
import '../ui/ui-page-header';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-icon-button';
import '../ui/ui-textarea';
import '../ui/ui-checkbox';
import '../ui/ui-data-grid';
import '../ui/ui-table';
import '../ui/ui-list-controls';
import '../ui/ui-color-input';
import '../ui/image-editor';
import '../items/wikidata-autocomplete';

type ViewMode = 'list' | 'create' | 'edit' | 'view' | 'curators';
type MuseumListLayout = 'grid' | 'table';
type MuseumSortField = 'name' | 'city' | 'country' | 'status';

interface MuseumFormData {
  wikidataId: string;
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  region: string;
  postalCode: string;
  website: string;
  phone: string;
  email: string;
  openingHours: string;
  ticketInfo: string;
  coverImage: string;
  navigatorConfigs: NavigatorConfigFormData[];
}

interface NavigatorConfigFormData {
  id: string;
  name: string;
  slug: string;
  logo: string;
  splashImage: string;
  primaryColor: string;
  secondaryColor: string;
  homeTitle: string;
  homeSubtitle: string;
  welcomeText: string;
  openingImage: string;
  manifestName: string;
  shortName: string;
  manifestDescription: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'any' | 'natural' | 'landscape' | 'portrait';
  startUrl: string;
  scope: string;
  icon192: string;
  icon512: string;
  iconMaskable: string;
  appleTouchIcon: string;
}

interface NavigatorConfigRaw {
  id: string;
  name: string;
  slug: string;
  branding: {
    logo?: string;
    splashImage?: string;
    primaryColor: string;
    secondaryColor?: string;
  };
  content?: {
    homeTitle?: string;
    homeSubtitle?: string;
    welcomeText?: string;
    openingImage?: string;
  };
  pwa: {
    manifestName: string;
    shortName: string;
    description?: string;
    themeColor: string;
    backgroundColor: string;
    display: NavigatorConfigFormData['display'];
    orientation: NavigatorConfigFormData['orientation'];
    startUrl: string;
    scope: string;
    icon192?: string;
    icon512?: string;
    iconMaskable?: string;
    appleTouchIcon?: string;
  };
}

/**
 * Museum Management Page
 *
 * Admin interface for managing museums and curator assignments.
 * Only admins can create/delete museums.
 * Admins and curators can edit museums they have access to.
 */
@customElement('museums-management-page')
export class MuseumsManagementPage extends LitElement {
  private static readonly HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  @property({ type: Object }) currentUser: User | null = null;
  @property({ type: String }) selectedMuseumId = '';
  @property({ type: String }) configMode: 'full' | 'museum' | 'navigator' = 'full';

  @state() private viewMode: ViewMode = 'list';
  @state() private museums: Museum[] = [];
  @state() private selectedMuseum: Museum | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';

  // Search
  @state() private searchQuery = '';
  @state() private controlsCollapsed = true;
  @state() private listLayout: MuseumListLayout = 'grid';
  @state() private sortField: MuseumSortField = 'name';
  @state() private sortDirection: 'asc' | 'desc' = 'asc';
  @state() private visibleColumns: string[] = ['name', 'city', 'country', 'status'];

  // Form data
  @state() private formData: MuseumFormData = this.getEmptyFormData();

  // Delete modal
  @state() private deleteModalOpen = false;
  @state() private museumToDelete: Museum | null = null;
  @state() private deleting = false;

  // Curator management
  @state() private curators: MuseumCurator[] = [];
  @state() private loadingCurators = false;
  @state() private availableUsers: User[] = [];
  @state() private loadingUsers = false;
  @state() private selectedUserId = '';
  @state() private addingCurator = false;
  @state() private removingCuratorId: string | null = null;

  private readonly listSortOptions: Array<{ value: MuseumSortField; label: string }> = [
    { value: 'name', label: 'Nome' },
    { value: 'city', label: 'Città' },
    { value: 'country', label: 'Paese' },
    { value: 'status', label: 'Stato' },
  ];

  private readonly listColumnOptions: Array<{ key: string; label: string }> = [
    { key: 'name', label: 'Nome' },
    { key: 'city', label: 'Città' },
    { key: 'country', label: 'Paese' },
    { key: 'status', label: 'Stato' },
  ];

  private readonly defaultVisibleColumns = ['name', 'city', 'country', 'status'];

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.configMode === 'full') {
      this.loadMuseums();
    } else {
      this.loadSelectedMuseumForConfigMode();
    }
  }

  updated(changedProps: Map<string, unknown>) {
    if (
      (changedProps.has('selectedMuseumId') || changedProps.has('configMode')) &&
      this.configMode !== 'full'
    ) {
      this.loadSelectedMuseumForConfigMode();
    }
  }

  private getEmptyFormData(): MuseumFormData {
    return {
      wikidataId: '',
      name: '',
      description: '',
      address: '',
      city: '',
      country: 'Italia',
      region: '',
      postalCode: '',
      website: '',
      phone: '',
      email: '',
      openingHours: '',
      ticketInfo: '',
      coverImage: '',
      navigatorConfigs: [this.getEmptyNavigatorConfig(1)],
    };
  }

  private getEmptyNavigatorConfig(index: number): NavigatorConfigFormData {
    return {
      id: `cfg-${Date.now()}-${index}`,
      name: `Navigator ${index}`,
      slug: `navigator-${index}`,
      logo: '',
      splashImage: '',
      primaryColor: '#0ea5e9',
      secondaryColor: '#1f2937',
      homeTitle: '',
      homeSubtitle: '',
      welcomeText: '',
      openingImage: '',
      manifestName: `ArtAround Navigator ${index}`,
      shortName: `AANav ${index}`,
      manifestDescription: '',
      themeColor: '#0ea5e9',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      startUrl: '/',
      scope: '/',
      icon192: '',
      icon512: '',
      iconMaskable: '',
      appleTouchIcon: '',
    };
  }

  private mapNavigatorConfigsFromMuseum(museum: Museum): NavigatorConfigFormData[] {
    const navigatorConfigs = (museum as Museum & { navigatorConfigs?: NavigatorConfigRaw[] })
      .navigatorConfigs;

    if (!navigatorConfigs || navigatorConfigs.length === 0) {
      return [];
    }

    return navigatorConfigs.map((config) => ({
      id: config.id,
      name: config.name,
      slug: config.slug,
      logo: config.branding.logo || '',
      splashImage: config.branding.splashImage || '',
      primaryColor: config.branding.primaryColor,
      secondaryColor: config.branding.secondaryColor || '',
      homeTitle: config.content?.homeTitle || '',
      homeSubtitle: config.content?.homeSubtitle || '',
      welcomeText: config.content?.welcomeText || '',
      openingImage: config.content?.openingImage || '',
      manifestName: config.pwa.manifestName,
      shortName: config.pwa.shortName,
      manifestDescription: config.pwa.description || '',
      themeColor: config.pwa.themeColor,
      backgroundColor: config.pwa.backgroundColor,
      display: config.pwa.display,
      orientation: config.pwa.orientation,
      startUrl: config.pwa.startUrl,
      scope: config.pwa.scope,
      icon192: config.pwa.icon192 || '',
      icon512: config.pwa.icon512 || '',
      iconMaskable: config.pwa.iconMaskable || '',
      appleTouchIcon: config.pwa.appleTouchIcon || '',
    })) as NavigatorConfigFormData[];
  }

  private addNavigatorConfig() {
    const nextIndex = this.formData.navigatorConfigs.length + 1;
    this.formData = {
      ...this.formData,
      navigatorConfigs: [
        ...this.formData.navigatorConfigs,
        this.getEmptyNavigatorConfig(nextIndex),
      ],
    };
  }

  private removeNavigatorConfig(id: string) {
    const remaining = this.formData.navigatorConfigs.filter((config) => config.id !== id);
    this.formData = { ...this.formData, navigatorConfigs: remaining };
  }

  private updateNavigatorConfig(id: string, patch: Partial<NavigatorConfigFormData>) {
    const updated = this.formData.navigatorConfigs.map((config) => {
      if (config.id !== id) {
        return config;
      }

      return {
        ...config,
        ...patch,
      };
    });

    this.formData = { ...this.formData, navigatorConfigs: updated };
  }

  private sanitizeSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeHexColor(value: string, fallback = '#000000'): string {
    const normalized = value.trim();
    if (MuseumsManagementPage.HEX_COLOR_REGEX.test(normalized)) {
      return normalized;
    }
    return fallback;
  }

  private updateNavigatorColor(
    id: string,
    key: 'primaryColor' | 'secondaryColor' | 'themeColor' | 'backgroundColor',
    value: string,
  ) {
    this.updateNavigatorConfig(id, {
      [key]: value,
    } as Partial<NavigatorConfigFormData>);
  }

  private validateNavigatorConfigsBeforeSubmit(): string | null {
    const configs = this.formData.navigatorConfigs;
    if (!configs.length) {
      return null;
    }

    const slugSet = new Set<string>();

    for (const config of configs) {
      if (!config.id.trim() || !config.name.trim()) {
        return 'Ogni configurazione deve avere ID e nome';
      }

      const slug = this.sanitizeSlug(config.slug);
      if (!slug || !MuseumsManagementPage.SLUG_REGEX.test(slug)) {
        return `Slug non valido per "${config.name}" (usa solo lettere minuscole, numeri e trattini)`;
      }

      if (slugSet.has(slug)) {
        return `Slug duplicato: ${slug}`;
      }
      slugSet.add(slug);

      if (!config.manifestName.trim() || !config.shortName.trim()) {
        return `Manifest name e short name sono obbligatori per "${config.name}"`;
      }

      if (!config.startUrl.trim() || !config.scope.trim()) {
        return `Start URL e scope sono obbligatori per "${config.name}"`;
      }

      if (!config.icon192.trim() || !config.icon512.trim()) {
        return `Le icone 192x192 e 512x512 sono obbligatorie per "${config.name}"`;
      }

      const colors = [
        { label: 'Primary color', value: config.primaryColor },
        { label: 'Theme color', value: config.themeColor },
        { label: 'Background color', value: config.backgroundColor },
      ];

      if (config.secondaryColor.trim()) {
        colors.push({ label: 'Secondary color', value: config.secondaryColor });
      }

      for (const color of colors) {
        if (!MuseumsManagementPage.HEX_COLOR_REGEX.test(color.value.trim())) {
          return `${color.label} non valido in "${config.name}". Usa formato HEX (es. #0ea5e9)`;
        }
      }
    }

    return null;
  }

  private buildNavigatorManifest(config: NavigatorConfigFormData) {
    const icons = [
      config.icon192
        ? {
            src: config.icon192,
            sizes: '192x192',
            type: 'image/png',
          }
        : null,
      config.icon512
        ? {
            src: config.icon512,
            sizes: '512x512',
            type: 'image/png',
          }
        : null,
      config.iconMaskable
        ? {
            src: config.iconMaskable,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          }
        : null,
      config.appleTouchIcon
        ? {
            src: config.appleTouchIcon,
            sizes: '180x180',
            type: 'image/png',
          }
        : null,
    ].filter(Boolean);

    return {
      name: config.manifestName,
      short_name: config.shortName,
      description: config.manifestDescription || undefined,
      start_url: config.startUrl,
      scope: config.scope,
      display: config.display,
      orientation: config.orientation,
      theme_color: config.themeColor,
      background_color: config.backgroundColor,
      icons,
    };
  }

  private exportNavigatorManifest(config: NavigatorConfigFormData) {
    const validationError = this.validateNavigatorConfigsBeforeSubmit();
    if (validationError) {
      this.error = validationError;
      return;
    }

    const manifest = this.buildNavigatorManifest(config);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/manifest+json',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${config.slug || 'navigator'}-manifest.webmanifest`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  private get isAdmin(): boolean {
    return this.currentUser?.role === UserRole.ADMIN;
  }

  private canEditMuseum(museum: Museum): boolean {
    if (!this.currentUser) return false;
    if (this.currentUser.role === UserRole.ADMIN) return true;

    // Check if user is a curator of this museum
    return (
      this.currentUser.roleAssignments?.some(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === museum._id &&
          assignment.role === ContextualRole.MANAGER,
      ) ?? false
    );
  }

  private async loadMuseums() {
    this.loading = true;
    this.error = '';

    try {
      this.museums = await museumService.getMuseums();
    } catch (e) {
      console.error('Error loading museums:', e);
      this.error = 'Errore nel caricamento dei musei';
    } finally {
      this.loading = false;
    }
  }

  private get filteredMuseums(): Museum[] {
    if (!this.searchQuery) return this.museums;
    const query = this.searchQuery.toLowerCase();
    return this.museums.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.location?.city?.toLowerCase().includes(query) ||
        m.description?.toLowerCase().includes(query),
    );
  }

  private get sortedMuseums(): Museum[] {
    const items = [...this.filteredMuseums];
    const multiplier = this.sortDirection === 'asc' ? 1 : -1;

    return items.sort((left, right) => {
      const leftCity = left.location?.city || '';
      const rightCity = right.location?.city || '';
      const leftCountry = left.location?.country || '';
      const rightCountry = right.location?.country || '';

      let result = 0;
      if (this.sortField === 'name') {
        result = left.name.localeCompare(right.name, 'it', { sensitivity: 'base' });
      } else if (this.sortField === 'city') {
        result = leftCity.localeCompare(rightCity, 'it', { sensitivity: 'base' });
      } else if (this.sortField === 'country') {
        result = leftCountry.localeCompare(rightCountry, 'it', { sensitivity: 'base' });
      } else {
        const leftActive = left.isActive ? 1 : 0;
        const rightActive = right.isActive ? 1 : 0;
        result = leftActive - rightActive;
      }

      if (result === 0) {
        result = left.name.localeCompare(right.name, 'it', { sensitivity: 'base' });
      }

      return result * multiplier;
    });
  }

  private get activeFilterCount(): number {
    return this.searchQuery.trim() ? 1 : 0;
  }

  private hasVisibleColumn(column: string): boolean {
    return this.visibleColumns.includes(column);
  }

  private toggleColumnVisibility(column: string, visible: boolean) {
    if (!visible && this.visibleColumns.length <= 1) {
      return;
    }

    if (visible) {
      this.visibleColumns = [...new Set([...this.visibleColumns, column])];
      return;
    }

    this.visibleColumns = this.visibleColumns.filter((key) => key !== column);
  }

  private resetListControls() {
    this.searchQuery = '';
    this.sortField = 'name';
    this.sortDirection = 'asc';
    this.listLayout = 'grid';
    this.visibleColumns = [...this.defaultVisibleColumns];
  }

  private renderListControlsSummary() {
    return html`
      <ui-badge
        variant=${this.activeFilterCount > 0 ? 'primary' : 'secondary'}
        .label=${`${this.activeFilterCount} filtri`}
      ></ui-badge>
    `;
  }

  private renderListControlsContent() {
    return html`
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <ui-input
          label="Ricerca"
          placeholder="Nome museo, città, descrizione..."
          .value=${this.searchQuery}
          @input-change=${(e: CustomEvent<{ value: string }>) =>
            (this.searchQuery = e.detail.value)}
        ></ui-input>

        <ui-select
          label="Ordina per"
          .value=${this.sortField}
          .options=${this.listSortOptions}
          @select-change=${(e: CustomEvent<{ value: MuseumSortField }>) =>
            (this.sortField = e.detail.value)}
        ></ui-select>

        <ui-select
          label="Direzione"
          .value=${this.sortDirection}
          .options=${[
            { value: 'asc', label: 'Crescente' },
            { value: 'desc', label: 'Decrescente' },
          ]}
          @select-change=${(e: CustomEvent<{ value: 'asc' | 'desc' }>) =>
            (this.sortDirection = e.detail.value)}
        ></ui-select>

        <div>
          <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">Vista</p>
          <div class="flex items-center gap-2">
            <ui-button
              size="xs"
              .variant=${this.listLayout === 'grid' ? 'primary' : 'secondary'}
              label="Griglia"
              @click=${() => (this.listLayout = 'grid')}
            ></ui-button>
            <ui-button
              size="xs"
              .variant=${this.listLayout === 'table' ? 'primary' : 'secondary'}
              label="Tabella"
              @click=${() => (this.listLayout = 'table')}
            ></ui-button>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-sm font-medium text-surface-700 dark:text-surface-300">Campi visibili</p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          ${this.listColumnOptions.map(
            (column) => html`
              <label class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
                <ui-checkbox
                  .checked=${this.visibleColumns.includes(column.key)}
                  @checkbox-change=${(e: CustomEvent<{ checked: boolean }>) =>
                    this.toggleColumnVisibility(column.key, e.detail.checked)}
                ></ui-checkbox>
                <span>${column.label}</span>
              </label>
            `,
          )}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <ui-button
          variant="secondary"
          size="sm"
          label="Reset"
          @click=${this.resetListControls}
        ></ui-button>
      </div>
    `;
  }

  private buildTableColumns(): TableColumn[] {
    const columns: TableColumn[] = [];

    if (this.hasVisibleColumn('name')) {
      columns.push({ key: 'name', label: 'Nome' });
    }
    if (this.hasVisibleColumn('city')) {
      columns.push({ key: 'city', label: 'Città' });
    }
    if (this.hasVisibleColumn('country')) {
      columns.push({ key: 'country', label: 'Paese' });
    }
    if (this.hasVisibleColumn('status')) {
      columns.push({
        key: 'status',
        label: 'Stato',
        render: (_value, row) => {
          const museum = row.__museum as Museum;
          return museum.isActive
            ? html`<ui-badge variant="success" label="Attivo"></ui-badge>`
            : html`<ui-badge variant="secondary" label="Inattivo"></ui-badge>`;
        },
      });
    }

    return columns;
  }

  private buildTableRows(items: Museum[]): Record<string, unknown>[] {
    return items.map((museum) => ({
      name: museum.name,
      city: museum.location?.city || '—',
      country: museum.location?.country || '—',
      status: museum.isActive ? 'Attivo' : 'Inattivo',
      __museum: museum,
    }));
  }

  private buildTableActions(): TableAction[] {
    const actions: TableAction[] = [];

    if (this.isAdmin) {
      actions.push({ icon: 'users', label: 'Gestisci Curatori', action: 'curators' });
    }

    actions.push({
      icon: 'edit',
      label: 'Modifica',
      action: 'edit',
      condition: (row) => this.canEditMuseum(row.__museum as Museum),
    });

    if (this.isAdmin) {
      actions.push({ icon: 'trash', label: 'Elimina', action: 'delete', variant: 'danger' });
    }

    return actions;
  }

  private handleTableAction(e: CustomEvent<{ action: string; row: Record<string, unknown> }>) {
    const museum = e.detail.row.__museum as Museum | undefined;
    if (!museum) return;

    if (e.detail.action === 'edit' && this.canEditMuseum(museum)) {
      this.openEditForm(museum);
    } else if (e.detail.action === 'curators' && this.isAdmin) {
      this.openCuratorsView(museum);
    } else if (e.detail.action === 'delete' && this.isAdmin) {
      this.openDeleteModal(museum);
    }
  }

  private renderTable(items: Museum[]) {
    return html`
      <ui-table
        .columns=${this.buildTableColumns()}
        .data=${this.buildTableRows(items)}
        .actions=${this.buildTableActions()}
        compact
        striped
        @row-action=${this.handleTableAction}
      ></ui-table>
    `;
  }

  private openCreateForm() {
    this.formData = this.getEmptyFormData();
    this.viewMode = 'create';
    this.error = '';
    this.success = '';
  }

  private async loadSelectedMuseumForConfigMode() {
    if (!this.selectedMuseumId) {
      this.viewMode = 'edit';
      this.selectedMuseum = null;
      this.error = 'Seleziona prima un museo dalla dashboard';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const museum = await museumService.getMuseum(this.selectedMuseumId);
      if (!museum) {
        this.error = 'Museo non trovato';
        return;
      }

      if (!this.canEditMuseum(museum)) {
        this.error = 'Non hai i permessi per configurare questo museo';
        return;
      }

      this.openEditForm(museum);
    } catch (e) {
      console.error('Error loading museum configuration:', e);
      this.error = 'Errore nel caricamento del museo';
    } finally {
      this.loading = false;
    }
  }

  private openEditForm(museum: Museum) {
    this.selectedMuseum = museum;
    this.formData = {
      wikidataId: museum.wikidataId || '',
      name: museum.name,
      description: museum.description || '',
      address: museum.location?.address || '',
      city: museum.location?.city || '',
      country: museum.location?.country || 'Italia',
      region: museum.location?.region || '',
      postalCode: museum.location?.postalCode || '',
      website: museum.services?.website || '',
      phone: museum.services?.phone || '',
      email: museum.services?.email || '',
      openingHours: museum.services?.openingHours || '',
      ticketInfo: museum.services?.ticketInfo || '',
      coverImage: museum.coverImage || '',
      navigatorConfigs: this.mapNavigatorConfigsFromMuseum(museum),
    };
    this.viewMode = 'edit';
    this.error = '';
    this.success = '';
  }

  private async openCuratorsView(museum: Museum) {
    this.selectedMuseum = museum;
    this.viewMode = 'curators';
    this.error = '';
    this.success = '';
    await this.loadCurators(museum._id);
    await this.loadAvailableUsers();
  }

  private async loadCurators(museumId: string) {
    this.loadingCurators = true;
    try {
      this.curators = await museumService.getCurators(museumId);
    } catch (e) {
      console.error('Error loading curators:', e);
      this.error = 'Errore nel caricamento dei curatori';
    } finally {
      this.loadingCurators = false;
    }
  }

  private async loadAvailableUsers() {
    this.loadingUsers = true;
    try {
      const response = await userService.getUsers({ limit: 100, isActive: true });
      // Filter out users who are already curators
      const curatorIds = new Set(this.curators.map((c) => c._id));
      this.availableUsers = response.users.filter((u) => !curatorIds.has(u._id));
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      this.loadingUsers = false;
    }
  }

  private async handleAddCurator() {
    if (!this.selectedUserId || !this.selectedMuseum) return;

    this.addingCurator = true;
    this.error = '';

    try {
      const result = await museumService.addCurator(this.selectedMuseum._id, this.selectedUserId);
      if (result.success) {
        this.success = 'Curatore aggiunto con successo';
        this.selectedUserId = '';
        await this.loadCurators(this.selectedMuseum._id);
        await this.loadAvailableUsers();
      } else {
        this.error = result.error || "Errore durante l'aggiunta del curatore";
      }
    } catch (e) {
      this.error = "Errore durante l'aggiunta del curatore";
    } finally {
      this.addingCurator = false;
    }
  }

  private async handleRemoveCurator(userId: string) {
    if (!this.selectedMuseum) return;

    this.removingCuratorId = userId;
    this.error = '';

    try {
      const result = await museumService.removeCurator(this.selectedMuseum._id, userId);
      if (result.success) {
        this.success = 'Curatore rimosso con successo';
        await this.loadCurators(this.selectedMuseum._id);
        await this.loadAvailableUsers();
      } else {
        this.error = result.error || 'Errore durante la rimozione del curatore';
      }
    } catch (e) {
      this.error = 'Errore durante la rimozione del curatore';
    } finally {
      this.removingCuratorId = null;
    }
  }

  private backToList() {
    if (this.configMode !== 'full') {
      this.dispatchEvent(
        new CustomEvent('navigate', {
          detail: { route: 'dashboard' },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.viewMode = 'list';
    this.selectedMuseum = null;
    this.error = '';
    this.success = '';
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    this.error = '';

    // Validation: wikidataId is required for new museums
    if (this.viewMode === 'create' && !this.formData.wikidataId) {
      this.error = 'Seleziona un museo da Wikidata prima di continuare';
      return;
    }

    const navigatorValidationError = this.validateNavigatorConfigsBeforeSubmit();
    if (navigatorValidationError) {
      this.error = navigatorValidationError;
      return;
    }

    this.saving = true;

    try {
      const data: CreateMuseumData & { navigatorConfigs?: unknown[] } = {
        wikidataId: this.formData.wikidataId,
        name: this.formData.name,
        description: this.formData.description,
        location: {
          address: this.formData.address,
          city: this.formData.city,
          country: this.formData.country,
          region: this.formData.region || undefined,
          postalCode: this.formData.postalCode || undefined,
        },
        coverImage: this.formData.coverImage || undefined,
        services: {
          website: this.formData.website || undefined,
          phone: this.formData.phone || undefined,
          email: this.formData.email || undefined,
          openingHours: this.formData.openingHours || undefined,
          ticketInfo: this.formData.ticketInfo || undefined,
        },
        navigatorConfigs:
          this.formData.navigatorConfigs.length > 0
            ? this.formData.navigatorConfigs.map((config) => ({
                id: config.id,
                name: config.name,
                slug: this.sanitizeSlug(config.slug),
                branding: {
                  logo: config.logo || undefined,
                  splashImage: config.splashImage || undefined,
                  primaryColor: config.primaryColor,
                  secondaryColor: config.secondaryColor || undefined,
                },
                content: {
                  homeTitle: config.homeTitle || undefined,
                  homeSubtitle: config.homeSubtitle || undefined,
                  welcomeText: config.welcomeText || undefined,
                  openingImage: config.openingImage || undefined,
                },
                pwa: {
                  manifestName: config.manifestName,
                  shortName: config.shortName,
                  description: config.manifestDescription || undefined,
                  themeColor: config.themeColor,
                  backgroundColor: config.backgroundColor,
                  display: config.display,
                  orientation: config.orientation,
                  startUrl: config.startUrl,
                  scope: config.scope,
                  icon192: config.icon192 || undefined,
                  icon512: config.icon512 || undefined,
                  iconMaskable: config.iconMaskable || undefined,
                  appleTouchIcon: config.appleTouchIcon || undefined,
                },
              }))
            : undefined,
      };

      if (this.viewMode === 'create') {
        const result = await museumService.createMuseum(data);
        if (result.data) {
          this.success = 'Museo creato con successo';
          await this.loadMuseums();
          this.backToList();
        } else {
          this.error = result.error || 'Errore durante la creazione';
        }
      } else if (this.viewMode === 'edit' && this.selectedMuseum) {
        const result = await museumService.updateMuseum(this.selectedMuseum._id, data);
        if (result.data) {
          this.success = 'Museo aggiornato con successo';
          await this.loadMuseums();
          this.backToList();
        } else {
          this.error = result.error || "Errore durante l'aggiornamento";
        }
      }
    } catch (e) {
      this.error = 'Errore durante il salvataggio';
    } finally {
      this.saving = false;
    }
  }

  private handleWikidataSelect(e: CustomEvent) {
    const { id, label, description, imageUrl } = e.detail;
    this.formData = {
      ...this.formData,
      wikidataId: id,
      name: label || '',
      description: description || '',
      coverImage: imageUrl || '',
    };
  }

  private openDeleteModal(museum: Museum) {
    this.museumToDelete = museum;
    this.deleteModalOpen = true;
  }

  private closeDeleteModal() {
    this.deleteModalOpen = false;
    this.museumToDelete = null;
  }

  private async confirmDelete() {
    if (!this.museumToDelete) return;

    this.deleting = true;
    this.error = '';

    try {
      const result = await museumService.deleteMuseum(this.museumToDelete._id);
      if (result.success) {
        this.success = 'Museo eliminato con successo';
        await this.loadMuseums();
        this.closeDeleteModal();
      } else {
        this.error = result.error || "Errore durante l'eliminazione";
      }
    } catch (e) {
      this.error = "Errore durante l'eliminazione";
    } finally {
      this.deleting = false;
    }
  }

  render() {
    const isFocusedConfigMode = this.configMode !== 'full';

    return html`
      <div class="space-y-6 animate-fade-in">
        ${this.error
          ? html`<ui-alert
              variant="error"
              message=${this.error}
              dismissible
              @dismiss=${() => (this.error = '')}
            ></ui-alert>`
          : nothing}
        ${this.success
          ? html`<ui-alert
              variant="success"
              message=${this.success}
              dismissible
              @dismiss=${() => (this.success = '')}
            ></ui-alert>`
          : nothing}
        ${!isFocusedConfigMode && this.viewMode === 'list' ? this.renderList() : nothing}
        ${this.viewMode === 'create' || this.viewMode === 'edit' ? this.renderForm() : nothing}
        ${this.viewMode === 'curators' ? this.renderCurators() : nothing}

        <!-- Delete Modal -->
        <ui-modal
          .open=${this.deleteModalOpen}
          title="Elimina Museo"
          message="Sei sicuro di voler eliminare ${this.museumToDelete
            ?.name}? Questa azione è irreversibile."
          variant="danger"
          confirmLabel="Elimina"
          .loading=${this.deleting}
          @confirm=${this.confirmDelete}
          @cancel=${this.closeDeleteModal}
        ></ui-modal>
      </div>
    `;
  }

  private renderList() {
    const museums = this.sortedMuseums;

    return html`
      <ui-page-header title="Gestione Musei" description="Gestisci i musei e assegna curatori">
        ${this.isAdmin
          ? html`
              <ui-button
                slot="actions"
                variant="primary"
                icon="plus"
                label="Nuovo Museo"
                @click=${this.openCreateForm}
              ></ui-button>
            `
          : nothing}
      </ui-page-header>

      <ui-list-controls
        title="Filtri e visualizzazione"
        description="Compatto di default: espandi per cercare, ordinare e cambiare layout"
        .collapsed=${this.controlsCollapsed}
        .renderSummary=${() => this.renderListControlsSummary()}
        .renderContent=${() => this.renderListControlsContent()}
        @collapsed-change=${(e: CustomEvent<{ collapsed: boolean }>) =>
          (this.controlsCollapsed = e.detail.collapsed)}
      ></ui-list-controls>

      <!-- Museums Content -->
      ${this.loading
        ? html`<ui-loading></ui-loading>`
        : museums.length === 0
          ? html`<ui-empty
              title="Nessun museo trovato"
              description=${this.searchQuery
                ? 'Prova a modificare la ricerca'
                : 'Crea il primo museo per iniziare'}
              icon="folder"
            ></ui-empty>`
          : this.listLayout === 'grid'
            ? html`
                <ui-data-grid
                  .items=${museums}
                  .columns=${3}
                  .renderItem=${(museum: Museum) => this.renderMuseumCard(museum)}
                ></ui-data-grid>
              `
            : this.renderTable(museums)}
    `;
  }

  private renderMuseumCard(museum: Museum) {
    const canEdit = this.canEditMuseum(museum);
    const imageAttrs = museum.coverImage
      ? uploadService.getResponsiveImageAttrs(museum.coverImage, {
          widths: [480, 768, 1200],
          sizes: '(max-width: 1024px) 50vw, 33vw',
        })
      : null;

    return html`
      <ui-card class="overflow-hidden">
        <!-- Cover Image -->
        <div class="aspect-video bg-surface-100 dark:bg-surface-800 relative">
          ${museum.coverImage
            ? html`<img
                src=${imageAttrs?.src}
                srcset=${ifDefined(imageAttrs?.srcset)}
                sizes=${ifDefined(imageAttrs?.sizes)}
                alt=${museum.name}
                class="w-full h-full object-cover"
              />`
            : html`<div class="w-full h-full flex items-center justify-center">
                <ui-icon name="image" size="xl" class="text-surface-300"></ui-icon>
              </div>`}
        </div>

        <div class="p-4">
          <h3 class="font-semibold text-surface-900 dark:text-white text-lg mb-1">
            ${museum.name}
          </h3>
          ${this.hasVisibleColumn('city') || this.hasVisibleColumn('country')
            ? html`
                <p class="text-sm text-surface-500 dark:text-surface-400 mb-3">
                  ${this.hasVisibleColumn('city') ? museum.location?.city || '' : ''}
                  ${this.hasVisibleColumn('city') && this.hasVisibleColumn('country') ? ', ' : ''}
                  ${this.hasVisibleColumn('country') ? museum.location?.country || '' : ''}
                </p>
              `
            : nothing}

          <div class="flex items-center justify-between">
            <div class="flex gap-1">
              ${canEdit
                ? html`
                    <ui-icon-button
                      icon="edit"
                      title="Modifica"
                      @click=${() => this.openEditForm(museum)}
                    ></ui-icon-button>
                  `
                : nothing}
              ${this.isAdmin
                ? html`
                    <ui-icon-button
                      icon="users"
                      title="Gestisci Curatori"
                      @click=${() => this.openCuratorsView(museum)}
                    ></ui-icon-button>
                    <ui-icon-button
                      icon="trash"
                      variant="danger"
                      title="Elimina"
                      @click=${() => this.openDeleteModal(museum)}
                    ></ui-icon-button>
                  `
                : nothing}
            </div>
            ${this.hasVisibleColumn('status')
              ? museum.isActive
                ? html`<ui-badge variant="success" label="Attivo"></ui-badge>`
                : html`<ui-badge variant="secondary" label="Inattivo"></ui-badge>`
              : nothing}
          </div>
        </div>
      </ui-card>
    `;
  }

  private renderForm() {
    const isCreate = this.viewMode === 'create';
    const isMuseumOnlyMode = this.configMode === 'museum';
    const isNavigatorOnlyMode = this.configMode === 'navigator';
    const showBaseSections = !isNavigatorOnlyMode;
    const showNavigatorSection = !isMuseumOnlyMode;
    const canManageNavigatorConfigs = true;
    const formTitle = isCreate
      ? 'Nuovo Museo'
      : isMuseumOnlyMode
        ? `Modifica Museo ${this.selectedMuseum?.name || ''}`
        : isNavigatorOnlyMode
          ? `Configurazioni Navigator - ${this.selectedMuseum?.name || ''}`
          : `Modifica ${this.selectedMuseum?.name}`;
    const formDescription = isCreate
      ? 'Crea un nuovo museo nel sistema'
      : isMuseumOnlyMode
        ? 'Aggiorna dati e servizi del museo selezionato'
        : isNavigatorOnlyMode
          ? 'Gestisci branding, manifest e asset PWA del navigator'
          : 'Modifica le informazioni del museo';

    if (this.loading && this.configMode !== 'full') {
      return html`<ui-loading></ui-loading>`;
    }

    if (this.configMode !== 'full' && !this.selectedMuseum) {
      return html`
        <ui-empty
          title="Museo non disponibile"
          description="Seleziona un museo dalla dashboard per accedere a questa sezione"
          icon="folder"
        ></ui-empty>
      `;
    }
    const navigatorDisplayOptions = [
      { value: 'standalone', label: 'Standalone' },
      { value: 'fullscreen', label: 'Fullscreen' },
      { value: 'minimal-ui', label: 'Minimal UI' },
      { value: 'browser', label: 'Browser' },
    ];

    const navigatorOrientationOptions = [
      { value: 'portrait', label: 'Portrait' },
      { value: 'landscape', label: 'Landscape' },
      { value: 'natural', label: 'Natural' },
      { value: 'any', label: 'Any' },
    ];

    return html`
      <ui-page-header
        title=${formTitle}
        description=${formDescription}
        showBack
        @back=${this.backToList}
      ></ui-page-header>

      <form @submit=${this.handleSubmit} class="space-y-6">
        <section ?hidden=${!showBaseSections}>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="link" size="sm" class="text-blue-500"></ui-icon>
            Riferimento Wikidata
          </h3>
          <ui-card padding="none">
            <div class="p-6 space-y-4">
              ${isCreate
                ? html`
                    <wikidata-autocomplete
                      label="Cerca museo su Wikidata"
                      placeholder="Cerca il museo su Wikidata..."
                      searchType="museum"
                      required
                      @wikidata-select=${this.handleWikidataSelect}
                    ></wikidata-autocomplete>
                  `
                : html`
                    <div
                      class="p-3 rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700"
                    >
                      <label
                        class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
                        >ID Wikidata</label
                      >
                      <div class="flex items-center gap-2">
                        <ui-badge variant="secondary" .label=${this.formData.wikidataId}></ui-badge>
                        <span class="text-xs text-surface-500">(non modificabile)</span>
                      </div>
                    </div>
                  `}
              ${this.formData.wikidataId
                ? html`
                    <div
                      class="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                    >
                      <ui-badge variant="outline" .label=${this.formData.wikidataId}></ui-badge>
                      <span class="text-sm text-blue-700 dark:text-blue-300"
                        >${this.formData.name}</span
                      >
                    </div>
                  `
                : nothing}
            </div>
          </ui-card>
        </section>

        <section>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="image" size="sm" class="text-brand-500"></ui-icon>
            Informazioni Base
          </h3>
          <ui-card padding="none">
            <div class="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ui-input
                label="Nome *"
                placeholder="Nome del museo"
                .value=${this.formData.name}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, name: e.detail.value })}
                required
              ></ui-input>

              <image-editor
                label="Immagine di copertina"
                category="museums"
                .value=${this.formData.coverImage}
                maxWidth=${1200}
                maxHeight=${800}
                .maxOutputSizeMb=${3}
                defaultFormat="webp"
                @image-saved=${(e: CustomEvent) => {
                  this.formData = { ...this.formData, coverImage: e.detail.path || '' };
                }}
              ></image-editor>

              <div class="lg:col-span-2">
                <ui-textarea
                  label="Descrizione"
                  placeholder="Descrizione del museo..."
                  .value=${this.formData.description}
                  @textarea-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, description: e.detail.value })}
                  rows="4"
                ></ui-textarea>
              </div>
            </div>
          </ui-card>
        </section>

        <section>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="location" size="sm" class="text-emerald-500"></ui-icon>
            Posizione
          </h3>
          <ui-card padding="none">
            <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ui-input
                label="Indirizzo *"
                placeholder="Via..."
                .value=${this.formData.address}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, address: e.detail.value })}
                required
              ></ui-input>

              <ui-input
                label="Città *"
                placeholder="Città"
                .value=${this.formData.city}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, city: e.detail.value })}
                required
              ></ui-input>

              <ui-input
                label="Regione"
                placeholder="Regione"
                .value=${this.formData.region}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, region: e.detail.value })}
              ></ui-input>

              <ui-input
                label="CAP"
                placeholder="00000"
                .value=${this.formData.postalCode}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, postalCode: e.detail.value })}
              ></ui-input>

              <ui-input
                label="Paese *"
                placeholder="Italia"
                .value=${this.formData.country}
                @input-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, country: e.detail.value })}
                required
              ></ui-input>
            </div>
          </ui-card>
        </section>

        <section>
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white mb-4 flex items-center gap-2"
          >
            <ui-icon name="globe" size="sm" class="text-amber-500"></ui-icon>
            Contatti e Servizi
          </h3>
          <ui-card padding="none">
            <div class="p-6 space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ui-input
                  label="Sito Web"
                  placeholder="https://..."
                  .value=${this.formData.website}
                  @input-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, website: e.detail.value })}
                ></ui-input>
                <ui-input
                  label="Telefono"
                  placeholder="+39..."
                  .value=${this.formData.phone}
                  @input-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, phone: e.detail.value })}
                ></ui-input>
                <ui-input
                  label="Email"
                  type="email"
                  placeholder="info@museo.it"
                  .value=${this.formData.email}
                  @input-change=${(e: CustomEvent) =>
                    (this.formData = { ...this.formData, email: e.detail.value })}
                ></ui-input>
              </div>

              <ui-textarea
                label="Orari di apertura"
                placeholder="Lun-Ven: 9-18..."
                .value=${this.formData.openingHours}
                @textarea-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, openingHours: e.detail.value })}
                rows="3"
              ></ui-textarea>

              <ui-textarea
                label="Informazioni biglietti"
                placeholder="Prezzo intero, ridotto..."
                .value=${this.formData.ticketInfo}
                @textarea-change=${(e: CustomEvent) =>
                  (this.formData = { ...this.formData, ticketInfo: e.detail.value })}
                rows="3"
              ></ui-textarea>
            </div>
          </ui-card>
        </section>

        <section ?hidden=${!showNavigatorSection}>
          <div class="flex items-center justify-between mb-4">
            <h3
              class="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2"
            >
              <ui-icon name="cog" size="sm" class="text-purple-500"></ui-icon>
              Configurazioni Navigator
            </h3>
            ${canManageNavigatorConfigs
              ? html`<ui-button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  label="Aggiungi Config"
                  @click=${this.addNavigatorConfig}
                ></ui-button>`
              : nothing}
          </div>

          ${isNavigatorOnlyMode && this.formData.navigatorConfigs.length === 0
            ? html`<ui-empty
                title="Nessuna personalizzazione navigator"
                description="Questo museo non ha configurazioni navigator personalizzate. Usa Aggiungi Config per crearne una."
                icon="cog"
              ></ui-empty>`
            : nothing}

          <div class="space-y-4" ?hidden=${this.formData.navigatorConfigs.length === 0}>
            ${this.formData.navigatorConfigs.map(
              (config, index) => html`
                <ui-card padding="none">
                  <div class="p-6 space-y-5">
                    <div class="flex items-center justify-between">
                      <h4 class="font-semibold text-surface-900 dark:text-white">
                        Configurazione ${index + 1}
                      </h4>
                      <div class="flex items-center gap-2">
                        <ui-button
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon="download"
                          label="Export Manifest"
                          @click=${() => this.exportNavigatorManifest(config)}
                        ></ui-button>
                        ${canManageNavigatorConfigs
                          ? html`<ui-icon-button
                              icon="trash"
                              variant="danger"
                              title="Rimuovi configurazione"
                              @click=${() => this.removeNavigatorConfig(config.id)}
                            ></ui-icon-button>`
                          : nothing}
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ui-input
                        label="Nome Config *"
                        .value=${config.name}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { name: e.detail.value })}
                        required
                      ></ui-input>
                      <ui-input
                        label="Slug *"
                        .value=${config.slug}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            slug: this.sanitizeSlug(e.detail.value),
                          })}
                        required
                      ></ui-input>
                      <ui-input
                        label="Titolo Home"
                        .value=${config.homeTitle}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { homeTitle: e.detail.value })}
                      ></ui-input>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ui-input
                        label="Sottotitolo Home"
                        .value=${config.homeSubtitle}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { homeSubtitle: e.detail.value })}
                      ></ui-input>
                      <ui-input
                        label="Manifest Name *"
                        .value=${config.manifestName}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { manifestName: e.detail.value })}
                        required
                      ></ui-input>
                      <ui-input
                        label="Manifest Short Name *"
                        .value=${config.shortName}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { shortName: e.detail.value })}
                        required
                      ></ui-input>
                      <div class="space-y-1.5">
                        <label
                          class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                        >
                          Primary Color
                        </label>
                        <div class="flex items-center gap-2">
                          <ui-color-input
                            .value=${this.normalizeHexColor(config.primaryColor, '#0ea5e9')}
                            @input-change=${(e: CustomEvent) =>
                              this.updateNavigatorColor(config.id, 'primaryColor', e.detail.value)}
                          ></ui-color-input>
                          <div class="flex-1">
                            <ui-input
                              .value=${config.primaryColor}
                              @input-change=${(e: CustomEvent) =>
                                this.updateNavigatorColor(
                                  config.id,
                                  'primaryColor',
                                  e.detail.value,
                                )}
                            ></ui-input>
                          </div>
                        </div>
                      </div>
                      <div class="space-y-1.5">
                        <label
                          class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                        >
                          Secondary Color
                        </label>
                        <div class="flex items-center gap-2">
                          <ui-color-input
                            .value=${this.normalizeHexColor(config.secondaryColor, '#1f2937')}
                            @input-change=${(e: CustomEvent) =>
                              this.updateNavigatorColor(
                                config.id,
                                'secondaryColor',
                                e.detail.value,
                              )}
                          ></ui-color-input>
                          <div class="flex-1">
                            <ui-input
                              .value=${config.secondaryColor}
                              @input-change=${(e: CustomEvent) =>
                                this.updateNavigatorColor(
                                  config.id,
                                  'secondaryColor',
                                  e.detail.value,
                                )}
                            ></ui-input>
                          </div>
                        </div>
                      </div>
                      <div class="space-y-1.5">
                        <label
                          class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                        >
                          Theme Color
                        </label>
                        <div class="flex items-center gap-2">
                          <ui-color-input
                            .value=${this.normalizeHexColor(config.themeColor, '#0ea5e9')}
                            @input-change=${(e: CustomEvent) =>
                              this.updateNavigatorColor(config.id, 'themeColor', e.detail.value)}
                          ></ui-color-input>
                          <div class="flex-1">
                            <ui-input
                              .value=${config.themeColor}
                              @input-change=${(e: CustomEvent) =>
                                this.updateNavigatorColor(config.id, 'themeColor', e.detail.value)}
                            ></ui-input>
                          </div>
                        </div>
                      </div>
                      <div class="space-y-1.5">
                        <label
                          class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                        >
                          Background Color
                        </label>
                        <div class="flex items-center gap-2">
                          <ui-color-input
                            .value=${this.normalizeHexColor(config.backgroundColor, '#ffffff')}
                            @input-change=${(e: CustomEvent) =>
                              this.updateNavigatorColor(
                                config.id,
                                'backgroundColor',
                                e.detail.value,
                              )}
                          ></ui-color-input>
                          <div class="flex-1">
                            <ui-input
                              .value=${config.backgroundColor}
                              @input-change=${(e: CustomEvent) =>
                                this.updateNavigatorColor(
                                  config.id,
                                  'backgroundColor',
                                  e.detail.value,
                                )}
                            ></ui-input>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ui-select
                        label="Display"
                        .value=${config.display}
                        .options=${navigatorDisplayOptions}
                        @select-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            display: e.detail.value as NavigatorConfigFormData['display'],
                          })}
                      ></ui-select>
                      <ui-select
                        label="Orientation"
                        .value=${config.orientation}
                        .options=${navigatorOrientationOptions}
                        @select-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            orientation: e.detail.value as NavigatorConfigFormData['orientation'],
                          })}
                      ></ui-select>
                      <ui-input
                        label="Start URL"
                        .value=${config.startUrl}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            startUrl: e.detail.value || '/',
                          })}
                      ></ui-input>
                      <ui-input
                        label="Scope"
                        .value=${config.scope}
                        @input-change=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { scope: e.detail.value || '/' })}
                      ></ui-input>
                    </div>

                    <ui-textarea
                      label="Testo di benvenuto"
                      .value=${config.welcomeText}
                      @textarea-change=${(e: CustomEvent) =>
                        this.updateNavigatorConfig(config.id, { welcomeText: e.detail.value })}
                      rows="3"
                    ></ui-textarea>

                    <ui-textarea
                      label="Manifest Description"
                      .value=${config.manifestDescription}
                      @textarea-change=${(e: CustomEvent) =>
                        this.updateNavigatorConfig(config.id, {
                          manifestDescription: e.detail.value,
                        })}
                      rows="2"
                    ></ui-textarea>

                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <image-editor
                        label="Logo"
                        category="misc"
                        .value=${config.logo}
                        maxWidth=${512}
                        maxHeight=${512}
                        defaultFormat="png"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { logo: e.detail.path || '' })}
                      ></image-editor>

                      <image-editor
                        label="Immagine apertura"
                        category="misc"
                        .value=${config.splashImage}
                        maxWidth=${1440}
                        maxHeight=${2560}
                        defaultFormat="webp"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            splashImage: e.detail.path || '',
                          })}
                      ></image-editor>

                      <image-editor
                        label="Opening image"
                        category="misc"
                        .value=${config.openingImage}
                        maxWidth=${1440}
                        maxHeight=${2560}
                        defaultFormat="webp"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            openingImage: e.detail.path || '',
                          })}
                      ></image-editor>

                      <image-editor
                        label="Icon 192x192"
                        category="misc"
                        .value=${config.icon192}
                        maxWidth=${192}
                        maxHeight=${192}
                        defaultFormat="png"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { icon192: e.detail.path || '' })}
                      ></image-editor>

                      <image-editor
                        label="Icon 512x512"
                        category="misc"
                        .value=${config.icon512}
                        maxWidth=${512}
                        maxHeight=${512}
                        defaultFormat="png"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, { icon512: e.detail.path || '' })}
                      ></image-editor>

                      <image-editor
                        label="Icon maskable"
                        category="misc"
                        .value=${config.iconMaskable}
                        maxWidth=${512}
                        maxHeight=${512}
                        defaultFormat="png"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            iconMaskable: e.detail.path || '',
                          })}
                      ></image-editor>

                      <image-editor
                        label="Apple touch icon"
                        category="misc"
                        .value=${config.appleTouchIcon}
                        maxWidth=${180}
                        maxHeight=${180}
                        defaultFormat="png"
                        @image-saved=${(e: CustomEvent) =>
                          this.updateNavigatorConfig(config.id, {
                            appleTouchIcon: e.detail.path || '',
                          })}
                      ></image-editor>
                    </div>
                  </div>
                </ui-card>
              `,
            )}
          </div>
        </section>

        <div class="flex justify-end gap-3">
          <ui-button variant="secondary" label="Annulla" @click=${this.backToList}></ui-button>
          <ui-button
            type="submit"
            variant="primary"
            label=${isCreate ? 'Crea Museo' : 'Salva Modifiche'}
            icon="check"
            .loading=${this.saving}
          ></ui-button>
        </div>
      </form>
    `;
  }

  private renderCurators() {
    return html`
      <ui-page-header
        title="Curatori - ${this.selectedMuseum?.name}"
        description="Gestisci i curatori che possono modificare questo museo"
        showBack
        @back=${this.backToList}
      ></ui-page-header>

      <ui-card padding="none">
        <div class="p-6 space-y-6">
          <!-- Add Curator -->
          <ui-section
            title="Aggiungi Curatore"
            description="Assegna un nuovo curatore a questo museo"
            .renderContent=${() => html`
              <div class="flex gap-3 items-end">
                <div class="flex-1">
                  <ui-select
                    label="Seleziona utente"
                    placeholder=${this.loadingUsers ? 'Caricamento...' : 'Scegli un utente'}
                    .value=${this.selectedUserId}
                    .options=${this.availableUsers.map((u) => ({
                      value: u._id,
                      label: `${u.username} (${u.email})`,
                    }))}
                    @select-change=${(e: CustomEvent) => (this.selectedUserId = e.detail.value)}
                    ?disabled=${this.loadingUsers}
                  ></ui-select>
                </div>
                <ui-button
                  variant="primary"
                  label="Aggiungi"
                  icon="plus"
                  .loading=${this.addingCurator}
                  ?disabled=${!this.selectedUserId}
                  @click=${this.handleAddCurator}
                ></ui-button>
              </div>
            `}
          ></ui-section>

          <!-- Curators List -->
          <ui-section
            title="Curatori Attuali"
            description="Utenti con permesso di modifica"
            .renderContent=${() =>
              this.loadingCurators
                ? html`<ui-loading></ui-loading>`
                : this.curators.length === 0
                  ? html`<p class="text-surface-500 text-sm">Nessun curatore assegnato</p>`
                  : html`
                      <div class="space-y-3">
                        ${this.curators.map(
                          (curator) => html`
                            <div
                              class="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800"
                            >
                              <div class="flex items-center gap-3">
                                <div
                                  class="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center"
                                >
                                  <span class="text-brand-700 dark:text-brand-300 font-medium">
                                    ${curator.username.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div>
                                  <p class="font-medium text-surface-900 dark:text-white">
                                    ${curator.username}
                                  </p>
                                  <p class="text-sm text-surface-500">${curator.email}</p>
                                </div>
                              </div>
                              <ui-button
                                variant="ghost"
                                size="sm"
                                label="Rimuovi"
                                icon="trash"
                                .loading=${this.removingCuratorId === curator._id}
                                @click=${() => this.handleRemoveCurator(curator._id)}
                              ></ui-button>
                            </div>
                          `,
                        )}
                      </div>
                    `}
          ></ui-section>
        </div>
      </ui-card>
    `;
  }
}
