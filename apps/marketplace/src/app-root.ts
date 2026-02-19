import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from './services/auth.service';
import { preferencesService } from './services/preferences.service';
import { ContextualRole, ResourceType, UserRole, type User } from '@artaround/shared';

// Check if we're in development mode (Vite built-in)
const isDev = import.meta.env.DEV;

// Import components
import './components/auth/login-page';
import './components/layout/admin-sidebar';
import './components/layout/admin-header';
import './components/pages/dashboard-page';
import './components/pages/museums-page';
import './components/pages/artworks-page';
import './components/pages/contents-page';
import './components/pages/users-page';
import './components/visits/visits-page';
import './components/museums/museum-map-page';
import './components/museums/museums-management-page';
import './components/navigator/navigator-default-config-page';

@customElement('app-root')
export class AppRoot extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state()
  private currentUser: User | null = null;

  @state()
  private currentRoute = 'dashboard';

  @state()
  private routeParams: Record<string, string> = {};

  @state()
  private pageTitle = 'Dashboard';

  @state()
  private sidebarCollapsed = false;

  @state()
  private loading = true;

  private renderDevBadge() {
    if (!isDev) return null;
    return html`
      <div
        class="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-amber-950 text-xs font-bold uppercase rounded-full shadow-lg animate-pulse"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
        DEV
      </div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.checkAuth();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    super.disconnectedCallback();
  }

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

    if (route === 'logout') {
      this.handleLogout();
      return;
    }

    if (this.requiresMuseumConfigAccess(route) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      return;
    }

    if (route === 'navigator-default-config' && this.currentUser?.role !== UserRole.ADMIN) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      return;
    }

    this.currentRoute = route;

    // Update page title based on route
    const titles: Record<string, string> = {
      dashboard: 'Dashboard',
      museums: 'Musei',
      'museums-management': 'Gestione Musei',
      'museum-maps': 'Gestione Mappe',
      'museum-edit': 'Modifica Museo',
      artworks: 'Gestione Opere',
      'navigator-customizations': 'Configurazioni Navigator',
      'navigator-default-config': 'Configurazione default app navigator',
      contents: 'Contenuti',
      visits: 'Visite',
      users: 'Gestione Utenti',
      categories: 'Categorie',
      tags: 'Tag',
      analytics: 'Analytics',
      settings: 'Impostazioni',
    };
    this.pageTitle = titles[route] || 'Dashboard';
  }

  renderPage() {
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
        ></museum-map-page>`;
      case 'artworks':
        return html`<artworks-page
          .user=${this.currentUser}
          .openingArtworkId=${this.routeParams.artworkId || ''}
        ></artworks-page>`;
      case 'contents':
        return html`<contents-page .user=${this.currentUser}></contents-page>`;
      case 'visits':
        return html`<visits-page .user=${this.currentUser}></visits-page>`;
      case 'users':
        return html`<users-page .currentUser=${this.currentUser}></users-page>`;
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
                Questa sezione è in fase di sviluppo
              </p>
            </div>
          </div>
        `;
    }
  }

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
            <p class="text-sm text-surface-500 dark:text-surface-400">Caricamento...</p>
          </div>
        </div>
      `;
    }

    if (!this.currentUser) {
      return html` <login-page @login-success=${this.handleLogin}></login-page> `;
    }

    const marginClass = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <div class="min-h-screen bg-surface-50 dark:bg-surface-950">
        <admin-sidebar
          .currentRoute=${this.currentRoute}
          .user=${this.currentUser}
          ?collapsed=${this.sidebarCollapsed}
          @navigate=${this.handleNavigate}
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
          >
            ${this.renderPage()}
          </div>
        </main>

        ${this.renderDevBadge()}
      </div>
    `;
  }

  private handleSidebarToggle() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  private handleMenuToggle() {
    const sidebar = this.querySelector('admin-sidebar') as HTMLElement & { toggleMobile(): void };
    if (sidebar) {
      sidebar.toggleMobile();
    }
  }

  private handleMuseumConfirmed(e: CustomEvent) {
    preferencesService.setSelectedMuseum(e.detail);
    this.currentRoute = 'artworks';
    this.pageTitle = 'Gestione Opere';
  }

  private handleSelectMuseum() {
    this.currentRoute = 'museums';
    this.pageTitle = 'Seleziona Museo';
  }

  private handleMuseumChanged = (event: CustomEvent) => {
    if (!event.detail) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
      this.routeParams = {};
      return;
    }

    if (this.requiresMuseumConfigAccess(this.currentRoute) && !this.canAccessMuseumConfigArea()) {
      this.currentRoute = 'dashboard';
      this.pageTitle = 'Dashboard';
    }
  };

  private handleOpenMapEditor(e: CustomEvent) {
    this.routeParams = { museumId: e.detail.museumId };
    this.currentRoute = 'museum-maps';
    this.pageTitle = 'Gestione Mappe';
  }

  private handleOpenArtworkDetail(e: CustomEvent) {
    const artworkId = e.detail?.artworkId;
    if (!artworkId) return;

    this.routeParams = { ...this.routeParams, artworkId: String(artworkId) };
    this.currentRoute = 'artworks';
    this.pageTitle = 'Gestione Opere';
  }

  private requiresMuseumConfigAccess(route: string): boolean {
    return route === 'museum-edit' || route === 'artworks' || route === 'navigator-customizations';
  }

  private canAccessMuseumConfigArea(): boolean {
    const selectedMuseum = preferencesService.getSelectedMuseum();

    if (!this.currentUser || !selectedMuseum) {
      return false;
    }

    if (this.currentUser.role === UserRole.ADMIN) {
      return true;
    }

    return (
      this.currentUser.roleAssignments?.some(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === selectedMuseum._id &&
          assignment.role === ContextualRole.MANAGER,
      ) ?? false
    );
  }
}
