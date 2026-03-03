import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  ContextualRole,
  ResourceType,
  UserRole,
  type User,
  type Museum,
  type Artwork,
  type Visit,
  type Item,
} from '@artaround/shared';
import { preferencesService } from '../../services/preferences.service';
import { artworkService } from '../../services/artwork.service';
import { itemService } from '../../services/item.service';
import { visitService } from '../../services/visit.service';
import { userService } from '../../services/user.service';
import { museumService } from '../../services/museum.service';
import './museums-page';
import '../ui/ui-card';
import '../ui/ui-badge';
import '../ui/ui-button';
import '../ui/ui-icon-button';
import '../ui/ui-page-header';
import '../ui/ui-alert';
import '../ui/ui-loading';
import '../ui/ui-stat-card';
import '../ui/ui-list-row';
import '../ui/ui-section-header';
import '../ui/ui-resource-list-card';
import { __ } from '../../services/i18n.service';

@customElement('dashboard-page')
export class DashboardPage extends LitElement {
  @property({ type: Object }) user: User | null = null;
  @state() private selectedMuseum: Museum | null = null;
  @state() private showMuseumSelector = false;
  @state() private loading = false;
  @state() private loadError = '';
  @state() private totalArtworks = 0;
  @state() private totalVisits = 0;
  @state() private totalContents = 0;
  @state() private totalActiveUsers = 0;
  @state() private totalActiveMuseums = 0;
  @state() private totalInsertedArtworks = 0;
  @state() private totalPublishedContents = 0;
  @state() private totalCreatedVisits = 0;
  @state() private recentArtworks: Artwork[] = [];
  @state() private recentVisits: Visit[] = [];
  @state() private curatorMuseums: Museum[] = [];
  @state() private authoredArtworks: Artwork[] = [];
  @state() private myItems: Item[] = [];
  @state() private myVisits: Visit[] = [];

  // ─── Internal State ──────────────────────────────────────
  private museumIndexById = new Map<string, Museum>();
  private museumsCache: Museum[] | null = null;

  // ─── Helpers ──────────────────────────────────────────────
  private async getMuseumsCached(): Promise<Museum[]> {
    if (this.museumsCache) {
      return this.museumsCache;
    }

    const museums = await museumService.getMuseums();
    this.museumsCache = museums;
    this.buildMuseumIndex(museums);
    return museums;
  }

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.selectedMuseum = preferencesService.getSelectedMuseum() as Museum | null;
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    this.loadDashboardData();
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    super.disconnectedCallback();
  }

  // ─── UI Actions ──────────────────────────────────────────
  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
    this.showMuseumSelector = false;
    this.loadDashboardData();
  };

  private handleSelectMuseum() {
    this.showMuseumSelector = !this.showMuseumSelector;
  }

  private handleMuseumConfirmed(e: CustomEvent) {
    const museum = e.detail as Museum;
    if (!museum) return;

    preferencesService.setSelectedMuseum({
      _id: museum._id,
      wikidataId: museum.wikidataId,
      name: museum.name,
    });
  }

  private clearMuseumSelection() {
    preferencesService.clearSelectedMuseum();
  }

  // ─── Data Loading ────────────────────────────────────────
  private async loadDashboardData() {
    this.loading = true;
    this.loadError = '';

    this.totalArtworks = 0;
    this.totalVisits = 0;
    this.recentArtworks = [];
    this.recentVisits = [];
    this.totalActiveMuseums = 0;
    this.totalInsertedArtworks = 0;
    this.totalPublishedContents = 0;
    this.totalCreatedVisits = 0;
    this.curatorMuseums = [];
    this.authoredArtworks = [];
    this.myItems = [];
    this.myVisits = [];

    try {
      const museumId = this.selectedMuseum?._id;

      if (museumId) {
        const [artworksResponse, visitsResponse, contentsResponse] = await Promise.all([
          artworkService.getArtworks({ museumId, page: 1, limit: 100 }),
          visitService.getVisits({ museumId, page: 1, limit: 100 }),
          itemService.getItems({ museumId, page: 1, limit: 100 }),
        ]);

        this.totalArtworks = artworksResponse.pagination.total;
        this.totalVisits = visitsResponse.pagination.total;
        this.totalContents = contentsResponse.pagination.total;
        this.recentArtworks = [...artworksResponse.artworks]
          .sort(
            (a, b) =>
              new Date(String(b.createdAt || 0)).getTime() -
              new Date(String(a.createdAt || 0)).getTime(),
          )
          .slice(0, 5);
        this.recentVisits = [...visitsResponse.visits]
          .sort(
            (a, b) =>
              new Date(String(b.createdAt || 0)).getTime() -
              new Date(String(a.createdAt || 0)).getTime(),
          )
          .slice(0, 5);
      }

      if (this.user?.role === UserRole.ADMIN) {
        const [users, museums, artworks, items, visits] = await Promise.all([
          userService.getUsers({ page: 1, limit: 1, isActive: true }),
          this.getMuseumsCached(),
          artworkService.getArtworks({ page: 1, limit: 1 }),
          itemService.getItems({ page: 1, limit: 1 }),
          visitService.getVisits({ page: 1, limit: 1 }),
        ]);

        this.totalActiveUsers = users.pagination.total;
        this.totalActiveMuseums = museums.length;
        this.totalInsertedArtworks = artworks.pagination.total;
        this.totalPublishedContents = items.pagination.total;
        this.totalCreatedVisits = visits.pagination.total;
      }

      await this.loadUserScopedLists();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.loadError = __('Errore nel caricamento dei dati reali della dashboard');
    } finally {
      this.loading = false;
    }
  }

  private buildMuseumIndex(museums: Museum[]): void {
    this.museumIndexById = new Map<string, Museum>();
    for (const museum of museums) {
      this.museumIndexById.set(museum._id, museum);
    }
  }

  private setSelectedMuseumById(museumId?: string): void {
    if (!museumId) return;
    const museum = this.museumIndexById.get(museumId);
    if (!museum) return;

    preferencesService.setSelectedMuseum({
      _id: museum._id,
      wikidataId: museum.wikidataId,
      name: museum.name,
    });
  }

  private getMuseumNameById(museumId?: string): string {
    if (!museumId) return __('Museo non specificato');
    return this.museumIndexById.get(museumId)?.name || museumId;
  }

  // ─── User Scoped Data ────────────────────────────────────
  private async loadUserScopedLists(): Promise<void> {
    if (!this.user?._id) return;

    const roleAssignments = this.user.roleAssignments || [];
    const curatorMuseumIds = roleAssignments
      .filter(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.role === ContextualRole.MANAGER,
      )
      .map((assignment) => assignment.resourceId);

    const authoredArtworkIds = roleAssignments
      .filter(
        (assignment) =>
          assignment.resourceType === ResourceType.ARTWORK &&
          assignment.role === ContextualRole.AUTHOR,
      )
      .map((assignment) => assignment.resourceId);

    const [allMuseums, myItems, myVisits] = await Promise.all([
      this.getMuseumsCached(),
      itemService.getMyItems(),
      visitService.getMyVisits(),
    ]);

    const curatorMuseumSet = new Set(curatorMuseumIds);
    this.curatorMuseums = allMuseums
      .filter((museum) => curatorMuseumSet.has(museum._id))
      .slice(0, 5);

    const authoredArtworks = await Promise.all(
      authoredArtworkIds.slice(0, 8).map(async (artworkId) => {
        return artworkService.getArtwork(artworkId);
      }),
    );

    const uniqueArtworks = new Map<string, Artwork>();
    for (const artwork of authoredArtworks) {
      if (!artwork) continue;
      uniqueArtworks.set(artwork._id, artwork);
    }

    this.authoredArtworks = Array.from(uniqueArtworks.values())
      .sort(
        (a, b) =>
          new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
          new Date(String(a.updatedAt || a.createdAt || 0)).getTime(),
      )
      .slice(0, 5);

    this.myItems = [...myItems]
      .sort(
        (a, b) =>
          new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
          new Date(String(a.updatedAt || a.createdAt || 0)).getTime(),
      )
      .slice(0, 5);

    this.myVisits = [...myVisits]
      .sort(
        (a, b) =>
          new Date(String(b.updatedAt || b.createdAt || 0)).getTime() -
          new Date(String(a.updatedAt || a.createdAt || 0)).getTime(),
      )
      .slice(0, 5);
  }

  // ─── Navigation Actions ──────────────────────────────────
  private formatDate(value?: string | Date): string {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('it-IT');
    } catch {
      return '-';
    }
  }

  private renderStatCard(label: string, value: number, icon: string) {
    return html`<ui-stat-card .label=${label} .value=${value} .icon=${icon}></ui-stat-card>`;
  }

  private goToRoute(route: string) {
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRecentArtworkClick(artwork: Artwork) {
    this.dispatchEvent(
      new CustomEvent('open-artwork-detail', {
        detail: { artworkId: artwork._id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRecentVisitClick() {
    this.goToRoute('visits');
  }

  private handleCuratorMuseumClick(museum: Museum) {
    preferencesService.setSelectedMuseum({
      _id: museum._id,
      wikidataId: museum.wikidataId,
      name: museum.name,
    });
    this.goToRoute('museum-edit');
  }

  private handleAuthoredArtworkClick(artwork: Artwork) {
    this.setSelectedMuseumById(artwork.museumId);
    this.handleRecentArtworkClick(artwork);
  }

  private handleMyItemClick(item: Item) {
    this.setSelectedMuseumById(item.museumId);
    this.goToRoute('contents');
  }

  private handleMyVisitRowClick(visit: Visit) {
    this.setSelectedMuseumById(visit.museumId);
    this.goToRoute('visits');
  }

  // ─── Render Helpers ──────────────────────────────────────
  private getVisitStatusBadge(visit: Visit) {
    return visit.isPublished
      ? html`<ui-badge variant="success" size="sm" .label=${__('Pubblicata')}></ui-badge>`
      : html`<ui-badge variant="warning" size="sm" .label=${__('Bozza')}></ui-badge>`;
  }

  private renderSecondaryBadge(label: string) {
    return html`<ui-badge variant="secondary" size="sm" .label=${label}></ui-badge>`;
  }

  private formatMuseumDateSubtitle(
    museumId: string | undefined,
    updatedAt: string | Date | undefined,
    createdAt: string | Date | undefined,
  ) {
    return `${this.getMuseumNameById(museumId)} • ${this.formatDate(updatedAt || createdAt)}`;
  }

  private renderVisitListRow(visit: Visit, subtitle: string, onClick: () => void) {
    return html`
      <ui-list-row
        .title=${visit.title || visit._id}
        .subtitle=${subtitle}
        .renderTrailing=${() => html`${this.getVisitStatusBadge(visit)}`}
        @click=${onClick}
      ></ui-list-row>
    `;
  }

  private renderSecondaryResourceListRow(
    title: string,
    subtitle: string,
    badgeLabel: string,
    onClick: () => void,
  ) {
    return html`
      <ui-list-row
        .title=${title}
        .subtitle=${subtitle}
        .renderTrailing=${() => this.renderSecondaryBadge(badgeLabel)}
        @click=${onClick}
      ></ui-list-row>
    `;
  }

  private renderCuratorMuseumsRows() {
    return this.curatorMuseums.map(
      (museum) => html`
        <ui-list-row
          .title=${museum.name}
          .subtitle=${`${museum.location?.city || '-'} • ${museum.location?.country || '-'}`}
          .renderTrailing=${() =>
            html`<ui-badge variant="success" size="sm" .label=${__('Curatore')}></ui-badge>`}
          @click=${() => this.handleCuratorMuseumClick(museum)}
        ></ui-list-row>
      `,
    );
  }

  private renderAuthoredArtworksRows() {
    return this.authoredArtworks.map((artwork) =>
      this.renderSecondaryResourceListRow(
        artwork.title || artwork._id,
        this.formatMuseumDateSubtitle(artwork.museumId, artwork.updatedAt, artwork.createdAt),
        artwork.artworkType,
        () => this.handleAuthoredArtworkClick(artwork),
      ),
    );
  }

  private renderMyItemsRows() {
    return this.myItems.map((item) =>
      this.renderSecondaryResourceListRow(
        item.title,
        this.formatMuseumDateSubtitle(item.museumId, item.updatedAt, item.createdAt),
        item.referenceType,
        () => this.handleMyItemClick(item),
      ),
    );
  }

  private renderMyVisitsRows() {
    return this.myVisits.map((visit) =>
      this.renderVisitListRow(
        visit,
        this.formatMuseumDateSubtitle(visit.museumId, visit.updatedAt, visit.createdAt),
        () => this.handleMyVisitRowClick(visit),
      ),
    );
  }

  private renderRecentArtworksRows() {
    return this.recentArtworks.map((artwork) =>
      this.renderSecondaryResourceListRow(
        artwork.title || artwork._id,
        `${artwork.author || __('Autore non specificato')} • ${this.formatDate(artwork.updatedAt || artwork.createdAt)}`,
        artwork.artworkType,
        () => this.handleRecentArtworkClick(artwork),
      ),
    );
  }

  private renderRecentVisitsRows() {
    return this.recentVisits.map((visit) =>
      this.renderVisitListRow(
        visit,
        `${visit.steps?.length || 0} step • ${this.formatDate(visit.updatedAt || visit.createdAt)}`,
        this.handleRecentVisitClick,
      ),
    );
  }

  private renderOpenRouteAction(route: string, label: string) {
    return html`
      <ui-button
        variant="ghost"
        size="xs"
        .label=${label}
        @click=${() => this.goToRoute(route)}
      ></ui-button>
    `;
  }

  private renderResourceListCard(options: {
    title: string;
    emptyText: string;
    count: number;
    renderItems: () => unknown;
    renderActions?: () => unknown;
  }) {
    return html`
      <ui-resource-list-card
        title=${options.title}
        emptyText=${options.emptyText}
        .count=${options.count}
        .renderItems=${options.renderItems}
        .renderActions=${options.renderActions || null}
      ></ui-resource-list-card>
    `;
  }

  private renderDashboardSection(title: string, description: string, content: () => unknown) {
    return html`
      <section class="space-y-4 pt-2 border-t border-surface-200 dark:border-surface-800">
        <ui-section-header .title=${title} .description=${description}></ui-section-header>
        ${content()}
      </section>
    `;
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="space-y-6 animate-fade-in">
        <ui-page-header
          .title=${__('Buongiorno') + ', ' + (this.user?.username?.split(' ')[0] || 'Admin')}
          .description=${__(
            'Benvenuto nella dashboard del marketplace. Qui puoi avere una panoramica delle attività recenti e gestire le tue opere e visite.',
          )}
        >
        </ui-page-header>

        ${this.loadError
          ? html`<ui-alert
              variant="error"
              message=${this.loadError}
              dismissible
              @dismiss=${() => (this.loadError = '')}
            ></ui-alert>`
          : nothing}

        <ui-card padding="md">
          <div class="space-y-4">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <p class="text-sm font-medium text-surface-700 dark:text-surface-300">
                  ${__('Museo attivo')}
                </p>
                <p class="mt-1 text-lg font-semibold text-surface-900 dark:text-white truncate">
                  ${this.selectedMuseum?.name || __('Nessun museo selezionato')}
                </p>
              </div>

              <ui-badge
                variant=${this.selectedMuseum ? 'success' : 'warning'}
                size="sm"
                .label=${this.selectedMuseum ? __('Selezionato') : __('Non selezionato')}
              ></ui-badge>
            </div>

            <div class="flex items-center justify-end gap-2 pt-1">
              <ui-button
                variant="secondary"
                size="sm"
                icon="location"
                .label=${this.showMuseumSelector ? __('Chiudi selettore') : __('Cambia museo')}
                @click=${this.handleSelectMuseum}
              ></ui-button>
              ${this.selectedMuseum
                ? html`
                    <ui-icon-button
                      icon="x"
                      .title=${__('Deseleziona museo')}
                      @click=${this.clearMuseumSelection}
                    ></ui-icon-button>
                  `
                : nothing}
            </div>

            ${this.showMuseumSelector
              ? html`
                  <div
                    class="border border-surface-200 dark:border-surface-800 rounded-xl p-3 bg-surface-50/50 dark:bg-surface-900/40"
                  >
                    <museums-page
                      .user=${this.user}
                      .embedded=${true}
                      @museum-confirmed=${this.handleMuseumConfirmed}
                    ></museums-page>
                  </div>
                `
              : nothing}
          </div>
        </ui-card>

        ${this.loading
          ? html`<ui-loading></ui-loading>`
          : html`
              ${this.user?.role === UserRole.ADMIN
                ? html`
                    <section class="space-y-3">
                      <ui-section-header
                        .title=${__('Dati generali')}
                        .description=${__('Panoramica complessiva della piattaforma')}
                      ></ui-section-header>
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        ${this.renderStatCard(
                          __('Utenti registrati'),
                          this.totalActiveUsers,
                          'users',
                        )}
                        ${this.renderStatCard(
                          __('Musei attivi'),
                          this.totalActiveMuseums,
                          'location',
                        )}
                        ${this.renderStatCard(
                          __('Opere inserite'),
                          this.totalInsertedArtworks,
                          'image',
                        )}
                        ${this.renderStatCard(
                          __('Contenuti pubblicati'),
                          this.totalPublishedContents,
                          'document',
                        )}
                        ${this.renderStatCard(
                          __('Visite create'),
                          this.totalCreatedVisits,
                          'visit',
                        )}
                      </div>
                    </section>
                  `
                : nothing}
              ${this.renderDashboardSection(
                __('Le mie risorse'),
                __('Elementi legati al tuo utente, indipendenti dal museo attivo'),
                () => html`
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    ${this.renderResourceListCard({
                      title: __('I musei di cui sono curatore'),
                      emptyText: __('Nessun museo assegnato'),
                      count: this.curatorMuseums.length,
                      renderItems: () => this.renderCuratorMuseumsRows(),
                    })}
                    ${this.renderResourceListCard({
                      title: __('Le opere di cui sono autore'),
                      emptyText: __('Nessuna opera assegnata'),
                      count: this.authoredArtworks.length,
                      renderItems: () => this.renderAuthoredArtworksRows(),
                    })}
                    ${this.renderResourceListCard({
                      title: __('I miei contenuti'),
                      emptyText: __('Nessun contenuto creato'),
                      count: this.myItems.length,
                      renderItems: () => this.renderMyItemsRows(),
                    })}
                    ${this.renderResourceListCard({
                      title: __('Le mie visite'),
                      emptyText: __('Nessuna visita creata'),
                      count: this.myVisits.length,
                      renderItems: () => this.renderMyVisitsRows(),
                    })}
                  </div>
                `,
              )}
              ${this.renderDashboardSection(
                __('Museo selezionato'),
                this.selectedMuseum
                  ? `${__('Statistiche e attività di')} ${this.selectedMuseum.name}`
                  : __('Seleziona un museo per visualizzare statistiche e attività dedicate'),
                () =>
                  !this.selectedMuseum
                    ? html`<ui-alert
                        variant="info"
                        .title=${__('Nessun museo attivo')}
                        .message=${__(
                          'Per lavorare su opere e configurazioni devi prima selezionare un museo.',
                        )}
                      ></ui-alert>`
                    : html`
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          ${this.renderStatCard(__('Opere nel museo'), this.totalArtworks, 'image')}
                          ${this.renderStatCard(
                            __('Contenuti pubblicati'),
                            this.totalContents,
                            'visit',
                          )}
                          ${this.renderStatCard(
                            __('Visite nel museo'),
                            this.totalVisits,
                            'document',
                          )}
                        </div>

                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          ${this.renderResourceListCard({
                            title: __('Ultime opere create'),
                            emptyText: __('Nessuna opera disponibile'),
                            count: this.recentArtworks.length,
                            renderActions: () =>
                              this.renderOpenRouteAction('artworks', __('Apri opere')),
                            renderItems: () => this.renderRecentArtworksRows(),
                          })}
                          ${this.renderResourceListCard({
                            title: __('Ultime visite'),
                            emptyText: __('Nessuna visita disponibile'),
                            count: this.recentVisits.length,
                            renderActions: () =>
                              this.renderOpenRouteAction('visits', __('Apri visite')),
                            renderItems: () => this.renderRecentVisitsRows(),
                          })}
                        </div>
                      `,
              )}
            `}
      </div>
    `;
  }
}
