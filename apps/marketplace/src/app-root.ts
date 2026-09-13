import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from './services/auth.service';
import { preferencesService } from './services/preferences.service';
import { routerService, type RouteState } from './services/router.service';
import { __ } from './services/i18n.service';
import { type User } from '@artaround/shared';
import { isContentCreator, isMuseumCurator } from './services/permissions.service';

// Import components sempre necessari nella shell iniziale (login, layout)
import './components/auth/login-page';
import './components/layout/admin-sidebar';
import './components/layout/admin-header';
import './components/ui/ui-scroll-top';
import './components/ui/ui-button';

// Le pagine vere e proprie vengono caricate on-demand (vedi PAGE_LOADERS più sotto):
// evita di mettere ~700KB di componenti nel bundle iniziale quando l'utente ne visita
// solo uno o due per sessione. Stesso pattern già usato per Leaflet in
// museums-management-page.ts (import() dinamico -> chunk separato).
const PAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('./components/pages/dashboard-page'),
  museums: () => import('./components/pages/museums-page'),
  'museums-management': () => import('./components/museums/museums-management-page'),
  'museum-edit': () => import('./components/museums/museums-management-page'),
  'navigator-customizations': () => import('./components/museums/museums-management-page'),
  'navigator-default-config': () => import('./components/navigator/navigator-default-config-page'),
  'museum-maps': () => import('./components/museums/museum-map-page'),
  artworks: () => import('./components/pages/artworks-page'),
  'author-area': () => import('./components/pages/author-area-page'),
  marketplace: () => import('./components/pages/marketplace-page'),
  purchases: () => import('./components/pages/purchases-page'),
  contents: () => import('./components/pages/contents-page'),
  visits: () => import('./components/visits/visits-page'),
  users: () => import('./components/pages/users-page'),
  settings: () => import('./components/pages/settings-page'),
};

@customElement('app-root')
export class AppRoot extends LitElement {
  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  @state()
  private currentUser: User | null = null;

  @state()
  private currentRoute = 'dashboard';

  @state()
  private routeParams: Record<string, string> = {};

  // ─── Ciclo di vita ───────────────────────────────────────────
  @state()
  private pageTitle = 'Dashboard';

  @state()
  private sidebarCollapsed = false;

  @state()
  private loading = true;

  // Tracking dei moduli-pagina caricati on-demand (vedi PAGE_LOADERS)
  private loadedPageModules = new Set<string>();
  private pendingPageModules = new Set<string>();
  // Route il cui chunk non è stato caricabile (vedi ensurePageLoaded/handlePageLoadError):
  // pilota lo spinner "vs" messaggio d'errore in renderPageLoading.
  private pageLoadError: string | null = null;

  // sessionStorage key usata per ricordare l'ultimo reload automatico tentato per un
  // chunk non caricabile (vedi handlePageLoadError) e non entrare in un loop di reload.
  private static readonly CHUNK_RELOAD_KEY = 'mp_chunk_reload_at';

  connectedCallback() {
    super.connectedCallback();
    const initial = routerService.init();
    // applyRoute valuta i permessi (canAccessMuseumConfigArea ecc.) su
    // this.currentUser: applicarla subito, prima che checkAuth() risolva,
    // lo troverebbe sempre null e rimanderebbe sempre alla dashboard un
    // refresh su qualunque stato che richieda un permesso — da qui aspetta
    // che l'utente sia noto.
    this.checkAuth().then(() => this.applyRoute(initial.route, initial.params));
    window.addEventListener('route-changed', this.handleRouteChanged as EventListener);
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('route-changed', this.handleRouteChanged as EventListener);
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    super.disconnectedCallback();
  }

  private handleRouteChanged = (event: CustomEvent<{ state: RouteState }>) => {
    this.applyRoute(event.detail.state.route, event.detail.state.params);
  };

  private handleLanguageChanged = (_event: CustomEvent) => {
    this.pageTitle = this.getRouteTitle(this.currentRoute);
  };

  private getRouteTitle(route: string): string {
    const labelByRoute: Record<string, string> = {
      dashboard: 'Dashboard',
      museums: 'Seleziona Museo',
      'museums-management': 'Gestione Musei',
      'museum-maps': 'Gestione Mappe',
      'museum-edit': 'Modifica Museo',
      artworks: 'Gestione Opere',
      'navigator-customizations': 'Configurazioni Navigator',
      'navigator-default-config': 'Configurazione default app navigator',
      'author-area': 'Area Autore',
      marketplace: 'Marketplace',
      purchases: 'Acquisti',
      contents: 'Contenuti',
      visits: 'Visite',
      users: 'Gestione Utenti',
      settings: 'Il mio account',
    };

    const label = labelByRoute[route] || 'Homepage';
    return __(label);
  }

  // ─── Autenticazione e navigazione ───────────────────────────────────
  async checkAuth() {
    // Check if there's a token first - avoid unnecessary API calls
    const token = localStorage.getItem('authToken');
    if (!token) {
      this.loading = false;
      return;
    }

    try {
      this.currentUser = await authService.getCurrentUser();
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      this.loading = false;
    }
  }

  handleLogin(e: CustomEvent) {
    this.currentUser = e.detail;
  }

  handleLogout() {
    authService.logout();
    this.currentUser = null;
  }

  handleNavigate(e: CustomEvent) {
    const route = e.detail.route;

    // Alcune voci di menu (es. museum-maps) portano parametri propri (museumId) nell'evento;
    // altrimenti si riparte puliti per non trascinarsi routeParams di una navigazione precedente.
    routerService.navigate(route, e.detail.params || {}, { title: this.getRouteTitle(route) });
  }

  // ─── Renderer delle rotte ─────────────────────────────────────
  /**
   * Assicura che il componente della pagina richiesta sia caricato prima di renderizzarla.
   * Ritorna true se già disponibile (nessuna pagina da caricare, o già caricata),
   * false se il caricamento è in corso: in quel caso renderPage() mostra uno spinner
   * e si aggiorna da sola (requestUpdate) appena il chunk arriva.
   */
  private ensurePageLoaded(route: string): boolean {
    const loader = PAGE_LOADERS[route];
    if (!loader || this.loadedPageModules.has(route)) {
      return true;
    }

    if (!this.pendingPageModules.has(route)) {
      this.pendingPageModules.add(route);
      this.pageLoadError = null;
      loader()
        .then(() => {
          this.loadedPageModules.add(route);
        })
        .catch((error) => {
          this.handlePageLoadError(route, error);
        })
        .finally(() => {
          this.pendingPageModules.delete(route);
          this.requestUpdate();
        });
    }

    return false;
  }

  /**
   * I chunk delle pagine sono file con hash nel nome (vedi vite.config.ts,
   * emptyOutDir: true): ogni nuovo deploy li rigenera e cancella quelli vecchi. Una
   * tab rimasta aperta a cavallo di un deploy continua a usare l'indice/manifest
   * della build precedente, quindi il primo import() di una pagina non ancora
   * caricata in questa sessione punta a un file che sul server non esiste più e
   * fallisce sempre allo stesso modo (da cui lo spinner infinito su "alcune pagine
   * sì, altre no" finché non si fa F5, che scarica l'index.html aggiornato).
   * Un retry dello stesso import() non risolve nulla: serve un reload completo.
   * Lo facciamo una sola volta (guardia via sessionStorage) per non entrare in loop
   * se il problema è invece un errore di rete reale.
   */
  private handlePageLoadError(route: string, error: unknown) {
    console.error(`Errore nel caricamento della pagina "${route}":`, error);

    const lastReload = Number(sessionStorage.getItem(AppRoot.CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - lastReload > 10_000) {
      sessionStorage.setItem(AppRoot.CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return;
    }

    // Abbiamo già ricaricato di recente e continua a fallire: non è uno stale chunk,
    // niente altro reload automatico, mostriamo un errore con retry manuale.
    this.pageLoadError = route;
  }

  private renderPageLoading(route: string) {
    if (this.pageLoadError === route) {
      return html`
        <div class="flex flex-col items-center justify-center min-h-[300px] gap-3 text-center">
          <p class="text-sm text-surface-500 dark:text-surface-400">
            ${__('Impossibile caricare questa pagina.')}
          </p>
          <ui-button
            variant="secondary"
            size="sm"
            .label=${__('Ricarica')}
            @click=${() => window.location.reload()}
          ></ui-button>
        </div>
      `;
    }

    return html`
      <div class="flex items-center justify-center min-h-[300px]">
        <div
          class="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin"
        ></div>
      </div>
    `;
  }

  renderPage() {
    if (!this.ensurePageLoaded(this.currentRoute)) {
      return this.renderPageLoading(this.currentRoute);
    }

    switch (this.currentRoute) {
      case 'dashboard':
        return html`<dashboard-page .user=${this.currentUser}></dashboard-page>`;
      case 'museums':
        return html`<museums-page
          .user=${this.currentUser}
          @museum-confirmed=${this.handleMuseumConfirmed}
          @open-map-editor=${this.handleOpenMapEditor}
        ></museums-page>`;
      case 'museums-management':
        return html`<museums-management-page
          .currentUser=${this.currentUser}
          .openingMuseumId=${this.routeParams.museumId || ''}
          .openingViewMode=${this.routeParams.viewMode || 'list'}
        ></museums-management-page>`;
      case 'museum-edit': {
        const selectedMuseum = preferencesService.getSelectedMuseum();
        return html`<museums-management-page
          .currentUser=${this.currentUser}
          .selectedMuseumId=${selectedMuseum?._id || ''}
          configMode="museum"
        ></museums-management-page>`;
      }
      case 'navigator-customizations': {
        const selectedMuseum = preferencesService.getSelectedMuseum();
        return html`<museums-management-page
          .currentUser=${this.currentUser}
          .selectedMuseumId=${selectedMuseum?._id || ''}
          configMode="navigator"
        ></museums-management-page>`;
      }
      case 'navigator-default-config':
        return html`<navigator-default-config-page></navigator-default-config-page>`;
      case 'museum-maps':
        return html`<museum-map-page
          .museumId=${this.routeParams.museumId || ''}
          .openingFloorId=${this.routeParams.floorId || ''}
          .openingMarkerId=${this.routeParams.markerId || ''}
        ></museum-map-page>`;
      case 'artworks':
        return html`<artworks-page
          .user=${this.currentUser}
          .openingArtworkId=${this.routeParams.artworkId || ''}
          .openingViewMode=${this.routeParams.viewMode || 'list'}
        ></artworks-page>`;
      case 'author-area':
        return html`<author-area-page .user=${this.currentUser}></author-area-page>`;
      case 'marketplace':
        return html`<marketplace-page .user=${this.currentUser}></marketplace-page>`;
      case 'purchases':
        return html`<purchases-page .user=${this.currentUser}></purchases-page>`;
      case 'contents':
        return html`<contents-page
          .user=${this.currentUser}
          .openingItemId=${this.routeParams.itemId || ''}
          .openingViewMode=${this.routeParams.viewMode || 'list'}
        ></contents-page>`;
      case 'visits':
        return html`<visits-page
          .user=${this.currentUser}
          .openingVisitId=${this.routeParams.visitId || ''}
          .openingViewMode=${this.routeParams.viewMode || 'list'}
          .openingTab=${this.routeParams.tab || ''}
        ></visits-page>`;
      case 'users':
        return html`<users-page
          .currentUser=${this.currentUser}
          .openingUserId=${this.routeParams.userId || ''}
          .openingViewMode=${this.routeParams.viewMode || 'list'}
        ></users-page>`;
      case 'settings':
        return html`<settings-page .user=${this.currentUser}></settings-page>`;
      default:
        return html`
          <div class="flex items-center justify-center min-h-[400px]">
            <div class="text-center">
              <div
                class="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
              >
                <svg
                  class="w-8 h-8 text-surface-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-surface-900 dark:text-white mb-1">
                ${this.pageTitle}
              </h3>
              <p class="text-sm text-surface-500 dark:text-surface-400">
                ${__('Questa sezione è in fase di sviluppo')}
              </p>
            </div>
          </div>
        `;
    }
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    // Show loading spinner while checking auth
    if (this.loading) {
      return html`
        <div
          class="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950"
        >
          <div class="text-center">
            <div
              class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4 animate-pulse"
            >
              <span class="text-white font-bold text-xl">A</span>
            </div>
            <p class="text-sm text-surface-500 dark:text-surface-400">${__('Caricamento...')}</p>
          </div>
        </div>
      `;
    }

    if (!this.currentUser) {
      return html` <login-page @login-success=${this.handleLogin}></login-page> `;
    }

    const marginClass = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <div class="min-h-screen bg-surface-50 dark:bg-surface-950" @navigate=${this.handleNavigate}>
        <!--
          @navigate è messo qui, sull'antenato comune, e non sui singoli admin-sidebar/
          admin-header: erano loro ad averlo (due volte, con rischio di doppia gestione se
          mai avessero condiviso un antenato), ma pagine come dashboard-page o
          museums-management-page — dentro <main>, cioè fratelli di sidebar/header, non
          discendenti — disperdevano l'evento "navigate" senza che nessuno lo intercettasse:
          i pulsanti "Apri opere"/"Apri visite" della dashboard e il "torna alla dashboard"
          di museums-management-page non facevano nulla.
        -->
        <admin-sidebar
          .currentRoute=${this.currentRoute}
          .user=${this.currentUser}
          ?collapsed=${this.sidebarCollapsed}
        ></admin-sidebar>

        <admin-header
          .title=${this.pageTitle}
          .user=${this.currentUser}
          ?sidebarCollapsed=${this.sidebarCollapsed}
          @menu-toggle=${this.handleMenuToggle}
          @sidebar-toggle=${this.handleSidebarToggle}
          @select-museum=${this.handleSelectMuseum}
          @logout=${this.handleLogout}
        ></admin-header>

        <main class="${marginClass} pt-16 min-h-screen transition-all duration-300">
          <div
            class="p-4 lg:p-6"
            @select-museum=${this.handleSelectMuseum}
            @open-artwork-detail=${this.handleOpenArtworkDetail}
            @page-state-changed=${this.handlePageStateChanged}
            @user-updated=${this.handleUserUpdated}
          >
            ${this.renderPage()}
          </div>
        </main>

        <ui-scroll-top></ui-scroll-top>
      </div>
    `;
  }

  // ─── Azioni ed eventi UI ─────────────────────────────────
  private handleSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private handleMenuToggle() {
    const sidebar = this.querySelector('admin-sidebar') as HTMLElement & { toggleMobile(): void };
    if (sidebar) {
      sidebar.toggleMobile();
    }
  }

  private handleUserUpdated(e: CustomEvent<User>) {
    this.currentUser = e.detail;
  }

  private handleMuseumConfirmed(e: CustomEvent) {
    preferencesService.setSelectedMuseum(e.detail);
    routerService.navigate('artworks', {}, { title: this.getRouteTitle('artworks') });
  }

  private handleSelectMuseum() {
    routerService.navigate('museums', {}, { title: this.getRouteTitle('museums') });
  }

  private handleMuseumChanged = (event: CustomEvent) => {
    if (!event.detail) {
      routerService.navigate(
        'dashboard',
        {},
        { replace: true, title: this.getRouteTitle('dashboard') },
      );
      return;
    }

    if (this.requiresMuseumConfigAccess(this.currentRoute) && !this.canAccessMuseumConfigArea()) {
      routerService.navigate(
        'dashboard',
        {},
        { replace: true, title: this.getRouteTitle('dashboard') },
      );
    }
  };

  private handleOpenMapEditor(e: CustomEvent) {
    routerService.navigate(
      'museum-maps',
      { museumId: e.detail.museumId },
      { title: this.getRouteTitle('museum-maps') },
    );
  }

  private handleOpenArtworkDetail(e: CustomEvent) {
    const artworkId = e.detail?.artworkId;
    if (!artworkId) return;

    routerService.navigate(
      'artworks',
      { ...this.routeParams, artworkId: String(artworkId) },
      { title: this.getRouteTitle('artworks') },
    );
  }

  /**
   * Stato granulare emesso da una pagina figlia (es. viewMode/entità
   * selezionata in artworks-page, tab attivo in visit-editor via
   * visits-page): si fonde con i routeParams correnti e diventa un vero
   * passo di history — stesso canale per qualunque pagina, non serve più
   * toccare app-root per aggiungerne una nuova. `replace` (opzionale, non è
   * un route param) sostituisce la voce corrente invece di aggiungerne una:
   * usato da una pagina quando risolve da sola un default non scelto
   * dall'utente (es. il primo piano di museum-map-page), per non produrre un
   * passo di history in più a ogni apertura.
   */
  private handlePageStateChanged(e: CustomEvent) {
    const { replace, ...params } = e.detail;
    routerService.navigate(
      this.currentRoute,
      { ...this.routeParams, ...params },
      { title: this.pageTitle, replace },
    );
  }

  // ─── Permessi ──────────────────────────────────────────
  private requiresMuseumConfigAccess(route: string): boolean {
    return (
      route === 'museum-edit' ||
      route === 'artworks' ||
      route === 'navigator-customizations' ||
      route === 'museum-maps'
    );
  }

  private requiresSelectedMuseum(route: string): boolean {
    return (
      route === 'author-area' ||
      route === 'marketplace' ||
      route === 'purchases' ||
      route === 'contents'
    );
  }

  private hasSelectedMuseum(): boolean {
    return Boolean(preferencesService.getSelectedMuseum()?._id);
  }

  private canAccessMuseumConfigArea(): boolean {
    const selectedMuseum = preferencesService.getSelectedMuseum();

    if (!this.currentUser || !selectedMuseum) {
      return false;
    }

    return isMuseumCurator(this.currentUser, selectedMuseum._id);
  }

  // ─── Routing ──────────────────────────────────
  /**
   * Unico punto che traduce "route+params" in stato renderizzato — usato
   * sia per il primo URL al boot sia per ogni evento `route-changed`
   * (click su un link di navigazione, popstate da un bottone avanti/indietro
   * vero del browser, o un redirect di permesso). Applica gli stessi
   * controlli di permesso indipendentemente da come si è arrivati alla
   * route, cosa che prima non era garantita (es. il check autore su
   * "author-area" valeva solo cliccando il menu, non tornando indietro).
   */
  private applyRoute(route: string, params: Record<string, string>): void {
    if (route === 'author-area' && !isContentCreator(this.currentUser)) {
      routerService.navigate(
        'dashboard',
        {},
        { replace: true, title: this.getRouteTitle('dashboard') },
      );
      return;
    }

    if (this.requiresSelectedMuseum(route) && !this.hasSelectedMuseum()) {
      routerService.navigate(
        'museums',
        {},
        { replace: true, title: this.getRouteTitle('museums') },
      );
      return;
    }

    if (this.requiresMuseumConfigAccess(route) && !this.canAccessMuseumConfigArea()) {
      routerService.navigate(
        'dashboard',
        {},
        { replace: true, title: this.getRouteTitle('dashboard') },
      );
      return;
    }

    if (route === 'navigator-default-config' && !this.currentUser?.isAdmin) {
      routerService.navigate(
        'dashboard',
        {},
        { replace: true, title: this.getRouteTitle('dashboard') },
      );
      return;
    }

    this.currentRoute = route;
    this.routeParams = params;
    this.pageTitle = this.getRouteTitle(route);
    window.scrollTo(0, 0);
  }
}
