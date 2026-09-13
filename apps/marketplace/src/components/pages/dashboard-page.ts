import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  MuseumRole,
  type User,
  type Museum,
  type Artwork,
  type Visit,
  type Item,
  type MuseumRoleRequest,
  type MuseumRoleRequestWithNames,
} from '@artaround/shared';
import { preferencesService } from '../../services/preferences.service';
import { artworkService } from '../../services/artwork.service';
import { itemService } from '../../services/item.service';
import { visitService } from '../../services/visit.service';
import { userService } from '../../services/user.service';
import { museumService } from '../../services/museum.service';
import { notificationsService } from '../../services/notifications.service';
import { authService } from '../../services/auth.service';
import './museums-page';
import '../ui/ui-card';
import '../ui/ui-badge';
import '../ui/ui-button';
import '../ui/ui-icon-button';
import '../ui/ui-icon';
import '../ui/ui-info-tip';
import '../ui/ui-page-header';
import '../ui/ui-alert';
import '../ui/ui-loading';
import '../ui/ui-stat-card';
import '../ui/ui-list-row';
import '../ui/ui-section-header';
import '../ui/ui-resource-list-card';
import '../ui/ui-select';
import '../ui/ui-search-list-picker';
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
  @state() private curatedArtworks: Artwork[] = [];
  @state() private myItems: Item[] = [];
  @state() private myVisits: Visit[] = [];

  // Richieste di ruolo museo: le mie (in attesa) e quelle che posso revisionare
  // (admin: tutte; curatore: solo per i musei che cura)
  @state() private myPendingRequests: MuseumRoleRequest[] = [];
  @state() private reviewableRequests: MuseumRoleRequestWithNames[] = [];
  @state() private requestModalOpen = false;
  @state() private requestMuseumOptions: { value: string; label: string }[] = [];
  @state() private requestFormMuseumId = '';
  @state() private requestFormRole: MuseumRole = MuseumRole.AUTHOR;
  @state() private requestSubmitting = false;
  @state() private requestError = '';
  @state() private requestSuccess = '';

  // ─── Stato interno ──────────────────────────────────────
  private museumIndexById = new Map<string, Museum>();
  private museumsCache: Museum[] | null = null;

  // ─── Helper ──────────────────────────────────────────────
  private async getMuseumsCached(): Promise<Museum[]> {
    if (this.museumsCache) {
      return this.museumsCache;
    }

    const museums = await museumService.getMuseums();
    this.museumsCache = museums;
    this.buildMuseumIndex(museums);
    return museums;
  }

  // ─── Ciclo di vita ───────────────────────────────────────────
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

  // ─── Azioni UI ──────────────────────────────────────────
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
      nameTranslations: museum.nameTranslations,
    });
  }

  private clearMuseumSelection() {
    preferencesService.clearSelectedMuseum();
  }

  // ─── Caricamento dati ────────────────────────────────────────
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
    this.curatedArtworks = [];
    this.myItems = [];
    this.myVisits = [];
    this.myPendingRequests = [];
    this.reviewableRequests = [];

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

      if (this.user?.isAdmin) {
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
      nameTranslations: museum.nameTranslations,
    });
  }

  private getMuseumNameById(museumId?: string): string {
    if (!museumId) return __('Museo non specificato');
    return this.museumIndexById.get(museumId)?.name || museumId;
  }

  // ─── Dati specifici dell'utente ────────────────────────────────────
  private async loadUserScopedLists(): Promise<void> {
    if (!this.user?._id) return;

    // Non esiste un CURATOR/AUTHOR globale: si è curatore di un museo solo
    // tramite museumRoles, sempre relativo a un museo specifico.
    const curatorMuseumIds = (this.user.museumRoles || [])
      .filter((assignment) => assignment.role === MuseumRole.CURATOR)
      .map((assignment) => assignment.museumId);

    const [allMuseums, myItems, myVisits] = await Promise.all([
      this.getMuseumsCached(),
      itemService.getMyItems(),
      visitService.getMyVisits(),
    ]);

    const curatorMuseumSet = new Set(curatorMuseumIds);
    this.curatorMuseums = allMuseums
      .filter((museum) => curatorMuseumSet.has(museum._id))
      .slice(0, 5);

    // Le opere non hanno un autore applicativo: qui mostriamo le opere
    // recenti dei musei che l'utente cura, non "le opere che ha scritto".
    const artworksByMuseum = await Promise.all(
      this.curatorMuseums.map((museum) => artworkService.getArtworksByMuseum(museum._id)),
    );

    const uniqueArtworks = new Map<string, Artwork>();
    for (const artwork of artworksByMuseum.flat()) {
      uniqueArtworks.set(artwork._id, artwork);
    }

    this.curatedArtworks = Array.from(uniqueArtworks.values())
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

    // Le mie richieste di ruolo in attesa (chiunque può averne), e quelle da
    // revisionare solo se admin o curatore di almeno un museo (altrimenti la
    // lista sarebbe comunque vuota lato server: evitiamo la chiamata inutile).
    const canReview = this.user.isAdmin || curatorMuseumIds.length > 0;
    const [myPendingRequests, reviewableRequests] = await Promise.all([
      authService.getMyRoleRequests(),
      canReview ? museumService.getReviewableRoleRequests() : Promise.resolve([]),
    ]);
    this.myPendingRequests = myPendingRequests;
    this.reviewableRequests = reviewableRequests;
  }

  // ─── Azioni di navigazione ──────────────────────────────────
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
      nameTranslations: museum.nameTranslations,
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

  // ─── Richieste di ruolo museo ────────────────────────────────
  private async openRequestModal() {
    this.requestFormMuseumId = '';
    this.requestFormRole = MuseumRole.AUTHOR;
    this.requestError = '';
    this.requestSuccess = '';
    this.requestModalOpen = true;

    const museums = await this.getMuseumsCached();
    this.requestMuseumOptions = museums.map((m) => ({ value: m._id, label: m.name }));
  }

  private closeRequestModal() {
    this.requestModalOpen = false;
  }

  private async handleSubmitRoleRequest() {
    if (!this.requestFormMuseumId) {
      this.requestError = __('Seleziona un museo');
      return;
    }

    this.requestSubmitting = true;
    this.requestError = '';

    const { data, error } = await museumService.requestRole(
      this.requestFormMuseumId,
      this.requestFormRole,
    );

    this.requestSubmitting = false;

    if (!data) {
      this.requestError = error || __('Errore durante la richiesta');
      return;
    }

    this.myPendingRequests = [data, ...this.myPendingRequests];
    this.requestSuccess = __('Richiesta inviata! Riceverai il ruolo appena confermata.');
    setTimeout(() => this.closeRequestModal(), 1200);
  }

  private async handleCancelMyRequest(request: MuseumRoleRequest) {
    const { success } = await museumService.cancelRoleRequest(request.museumId, request._id);
    if (success) {
      this.myPendingRequests = this.myPendingRequests.filter((r) => r._id !== request._id);
    }
  }

  private async handleApproveRequest(request: MuseumRoleRequestWithNames) {
    const { success } = await museumService.approveRoleRequest(request.museumId, request._id);
    if (success) {
      this.reviewableRequests = this.reviewableRequests.filter((r) => r._id !== request._id);
      // Approvare toglie anche la propria notifica "pending" per questa
      // richiesta (vedi resolveRoleRequestNotifications lato server) — la
      // campanella non aspetta i 20s del polling per rifletterlo.
      void notificationsService.refresh();
    }
  }

  private async handleRejectRequest(request: MuseumRoleRequestWithNames) {
    const { success } = await museumService.cancelRoleRequest(request.museumId, request._id);
    if (success) {
      this.reviewableRequests = this.reviewableRequests.filter((r) => r._id !== request._id);
      void notificationsService.refresh();
    }
  }

  // ─── Helper di render ──────────────────────────────────────
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

  private renderCuratedArtworksRows() {
    return this.curatedArtworks.map((artwork) =>
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
        () => this.handleRecentVisitClick(),
      ),
    );
  }

  private getMuseumRoleLabel(role: MuseumRole): string {
    return role === MuseumRole.CURATOR ? __('Curatore') : __('Autore');
  }

  private renderMyRolesCard() {
    const roles = this.user?.museumRoles || [];

    return html`
      <ui-card padding="md">
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <h3
              class="flex items-center gap-1.5 flex-wrap font-semibold text-surface-900 dark:text-white"
            >
              ${__('I tuoi ruoli')}
              <ui-info-tip
                variant="inline"
                text=${__(
                  'Curatore: gestione completa di quel museo (opere, sale, mappe, dati del museo) e può modificare/eliminare item e visite di chiunque. Autore: può creare item e visite per quel museo, ma modificare/eliminare solo i propri.',
                )}
              ></ui-info-tip>
            </h3>
            <ui-button
              variant="outline"
              size="sm"
              icon="plus"
              .label=${__('Chiedi un ruolo')}
              @click=${() => this.openRequestModal()}
            ></ui-button>
          </div>

          ${roles.length > 0
            ? html`
                <div class="flex flex-wrap gap-2">
                  ${roles.map(
                    (mr) => html`
                      <ui-badge
                        variant=${mr.role === MuseumRole.CURATOR ? 'success' : 'secondary'}
                        .label=${`${this.getMuseumRoleLabel(mr.role)} — ${this.getMuseumNameById(mr.museumId)}`}
                      ></ui-badge>
                    `,
                  )}
                </div>
              `
            : html`
                <div
                  class="rounded-xl p-5 bg-gradient-to-br from-brand-50 to-brand-100 dark:from-brand-900/20 dark:to-brand-950/20 border border-brand-200 dark:border-brand-800/60"
                >
                  <div class="flex items-start gap-3">
                    <ui-icon
                      name="sparkles"
                      size="lg"
                      class="text-brand-600 dark:text-brand-400 flex-shrink-0"
                    ></ui-icon>
                    <div>
                      <p class="font-semibold text-surface-900 dark:text-white">
                        ${__('Sei un appassionato e vuoi dare di più ad ArtAround?')}
                      </p>
                      <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
                        ${__(
                          'Chiedi di essere abilitato come Autore o Curatore di qualche museo. Il tuo contributo è importante!',
                        )}
                      </p>
                      <ui-button
                        class="mt-3"
                        variant="primary"
                        size="sm"
                        icon="sparkles"
                        .label=${__('Proponiti ora')}
                        @click=${() => this.openRequestModal()}
                      ></ui-button>
                    </div>
                  </div>
                </div>
              `}
          ${this.myPendingRequests.length > 0
            ? html`
                <div class="space-y-1.5 pt-1">
                  <p class="text-xs font-semibold text-surface-500 uppercase tracking-wider">
                    ${__('Richieste in attesa')}
                  </p>
                  ${this.myPendingRequests.map(
                    (r) => html`
                      <div
                        class="flex items-center justify-between p-2.5 rounded-lg bg-surface-50 dark:bg-surface-800/50 text-sm"
                      >
                        <span
                          >${this.getMuseumRoleLabel(r.role)} —
                          ${this.getMuseumNameById(r.museumId)}</span
                        >
                        <ui-icon-button
                          icon="x"
                          size="sm"
                          .title=${__('Annulla richiesta')}
                          @click=${() => this.handleCancelMyRequest(r)}
                        ></ui-icon-button>
                      </div>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
      </ui-card>
    `;
  }

  private renderReviewRequestsCard() {
    if (this.reviewableRequests.length === 0) return nothing;

    return html`
      <ui-card padding="md">
        <div class="space-y-3">
          <h3 class="font-semibold text-surface-900 dark:text-white">
            ${__('Richieste da revisionare')}
          </h3>
          ${this.reviewableRequests.map(
            (r) => html`
              <div
                class="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50"
              >
                <div class="min-w-0">
                  <p class="font-medium text-surface-900 dark:text-white truncate">
                    ${r.username || r.userId}
                  </p>
                  <p class="text-sm text-surface-500 truncate">
                    ${__('Chiede di diventare')} ${this.getMuseumRoleLabel(r.role).toLowerCase()}
                    ${__('di')} ${r.museumName || this.getMuseumNameById(r.museumId)}
                  </p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <ui-button
                    variant="danger"
                    size="sm"
                    .label=${__('Rifiuta')}
                    @click=${() => this.handleRejectRequest(r)}
                  ></ui-button>
                  <ui-button
                    variant="primary"
                    size="sm"
                    .label=${__('Approva')}
                    @click=${() => this.handleApproveRequest(r)}
                  ></ui-button>
                </div>
              </div>
            `,
          )}
        </div>
      </ui-card>
    `;
  }

  private renderRequestModal() {
    if (!this.requestModalOpen) return nothing;

    return html`
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.closeRequestModal();
        }}
      >
        <div
          class="bg-white dark:bg-surface-900 rounded-xl shadow-2xl w-full max-w-md flex flex-col"
        >
          <div class="p-6 border-b border-surface-200 dark:border-surface-700">
            <h3 class="text-lg font-semibold text-surface-900 dark:text-white">
              ${__('Chiedi di diventare curatore o autore')}
            </h3>
            <p class="text-sm text-surface-500 mt-1">
              ${__(
                'La richiesta va confermata da un admin o dal curatore del museo scelto — riceverai il ruolo appena approvata.',
              )}
            </p>
          </div>

          <div class="p-6 space-y-4">
            ${this.requestError
              ? html`<ui-alert variant="danger" .message=${this.requestError}></ui-alert>`
              : nothing}
            ${this.requestSuccess
              ? html`<ui-alert variant="success" .message=${this.requestSuccess}></ui-alert>`
              : nothing}

            <ui-select
              .label=${__('Ruolo')}
              .value=${this.requestFormRole}
              .options=${[
                { value: MuseumRole.AUTHOR, label: __('Autore') },
                { value: MuseumRole.CURATOR, label: __('Curatore') },
              ]}
              @select-change=${(e: CustomEvent) => (this.requestFormRole = e.detail.value)}
            ></ui-select>

            <ui-search-list-picker
              .label=${__('Museo')}
              .placeholder=${__('Cerca per nome...')}
              .emptyText=${__('Nessun museo disponibile')}
              .noResultsText=${__('Nessun risultato')}
              .options=${this.requestMuseumOptions}
              .value=${this.requestFormMuseumId}
              @value-change=${(e: CustomEvent<{ value: string }>) =>
                (this.requestFormMuseumId = e.detail.value)}
            ></ui-search-list-picker>
          </div>

          <div
            class="flex items-center justify-end gap-3 p-6 border-t border-surface-200 dark:border-surface-700"
          >
            <ui-button
              variant="ghost"
              .label=${__('Annulla')}
              @click=${() => this.closeRequestModal()}
            ></ui-button>
            <ui-button
              variant="primary"
              .label=${__('Invia richiesta')}
              @click=${() => this.handleSubmitRoleRequest()}
              ?loading=${this.requestSubmitting}
            ></ui-button>
          </div>
        </div>
      </div>
    `;
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

  private renderDashboardSection(
    title: string,
    description: string,
    content: () => unknown,
    help = '',
  ) {
    return html`
      <section class="space-y-4 pt-2 border-t border-surface-200 dark:border-surface-800">
        <ui-section-header
          .title=${title}
          .description=${description}
          .help=${help}
        ></ui-section-header>
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
          .help=${__(
            'Punto di ingresso del pannello: mostra il museo su cui stai lavorando, i tuoi ruoli e un riepilogo di ciò che hai creato. Le altre pagine (Opere, Contenuti, Visite) agiscono sempre sul "museo attivo" scelto qui.',
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
                <p
                  class="flex items-center gap-1.5 flex-wrap text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  ${__('Museo attivo')}
                  <ui-info-tip
                    variant="inline"
                    text=${__(
                      'Il museo su cui lavori finché non lo cambi: opere, contenuti e visite che crei o modifichi in tutte le altre pagine appartengono a questo museo.',
                    )}
                  ></ui-info-tip>
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
              ${this.renderMyRolesCard()} ${this.renderReviewRequestsCard()}
              ${this.user?.isAdmin
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
                      title: __('Opere recenti dei musei che curo'),
                      emptyText: __('Nessuna opera nei musei che curi'),
                      count: this.curatedArtworks.length,
                      renderItems: () => this.renderCuratedArtworksRows(),
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
                __(
                  'Contenuti e visite che hai creato tu, e i musei di cui sei curatore: restano gli stessi qualunque sia il museo attivo scelto sopra.',
                ),
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
                __(
                  'A differenza di "Le mie risorse", qui vedi tutto ciò che appartiene al museo attivo, anche se creato da altri autori/curatori — cambia se cambi museo sopra.',
                ),
              )}
            `}
      </div>
      ${this.renderRequestModal()}
    `;
  }
}
