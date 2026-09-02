import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ContextualRole, ResourceType, UserRole, type User } from '@artaround/shared';
import { preferencesService } from '../../services/preferences.service';
import { __ } from '../../services/i18n.service';
import '../ui/ui-icon';
import '../ui/ui-avatar';
import '../ui/ui-icon-button';
import '../ui/ui-brand-mark';

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  roles?: UserRole[]; // If set, only these roles can see this item
  requiresMuseum?: boolean;
}

@customElement('admin-sidebar')
export class AdminSidebar extends LitElement {
  @property({ type: String }) currentRoute = 'dashboard';
  @property({ type: Boolean }) collapsed = false;
  @property({ type: Object }) user: User | null = null;
  @state() private mobileOpen = false;
  @state() private selectedMuseum: { _id: string; name: string } | null = null;

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.selectedMuseum = preferencesService.getSelectedMuseum();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    super.disconnectedCallback();
  }

  // ─── Actions & Computed ──────────────────────────────────
  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
  };

  private handleLanguageChanged = (_event: CustomEvent) => {
    this.requestUpdate();
  };

  private get dashboardItem(): MenuItem {
    return { id: 'dashboard', label: __('Dashboard'), icon: 'home' };
  }

  private get primaryMenuItems(): MenuItem[] {
    return [
      {
        id: 'author-area',
        label: __('Area Autore'),
        icon: 'edit',
        // Anche il curatore può creare/modificare item e visite (vedi permissions.service.ts:
        // canCreateItem/canCreateVisit includono isCurator), ma prima non aveva alcun link per
        // arrivarci: qui era filtrato solo ad AUTHOR/ADMIN.
        roles: [UserRole.AUTHOR, UserRole.CURATOR, UserRole.ADMIN],
        requiresMuseum: true,
      },
      { id: 'marketplace', label: __('Marketplace'), icon: 'euro', requiresMuseum: true },
      { id: 'purchases', label: __('Acquisti'), icon: 'check', requiresMuseum: true },
    ];
  }

  private get configureMuseumMenuItems(): MenuItem[] {
    return [
      { id: 'museum-edit', label: __('Modifica Museo'), icon: 'edit' },
      { id: 'artworks', label: __('Gestione Opere'), icon: 'image' },
      { id: 'contents', label: __('Contenuti del museo'), icon: 'document' },
      { id: 'visits', label: __('Visite del museo'), icon: 'visit' },
      { id: 'museum-maps', label: __('Piantina e mappa'), icon: 'location' },
      {
        id: 'navigator-customizations',
        label: __('Configurazioni Navigator'),
        icon: 'cog',
      },
    ];
  }

  private get adminMenuItems(): MenuItem[] {
    return [
      {
        id: 'museums-management',
        label: __('Gestione Musei'),
        icon: 'cog',
        roles: ['admin' as UserRole],
      },
      {
        id: 'navigator-default-config',
        label: __('Configurazione default app navigator'),
        icon: 'cog',
        roles: ['admin' as UserRole],
      },
      { id: 'users', label: __('Gestione Utenti'), icon: 'users', roles: ['admin' as UserRole] },
    ];
  }

  private get bottomItems(): MenuItem[] {
    return [{ id: 'settings', label: __('Il mio account'), icon: 'cog' }];
  }

  private handleNavigate(route: string) {
    // museum-map-page ha bisogno del museumId del museo attivo come routeParam esplicito
    // (a differenza delle altre pagine, che lo leggono da preferencesService da sole):
    // prima questa voce non esisteva proprio nel menu, quindi il caso non si poneva.
    const params =
      route === 'museum-maps' && this.selectedMuseum
        ? { museumId: this.selectedMuseum._id }
        : undefined;

    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route, params },
        bubbles: true,
        composed: true,
      }),
    );

    // Sul cellulare il menu restava aperto dopo aver scelto una voce,
    // costringendo a un tap in più per chiuderlo — innocuo su desktop, dove
    // mobileOpen non pilota la sidebar fissa.
    this.mobileOpen = false;
  }

  private get canConfigureSelectedMuseum(): boolean {
    if (!this.user || !this.selectedMuseum) {
      return false;
    }

    if (this.user.role === UserRole.ADMIN) {
      return true;
    }

    return (
      this.user.roleAssignments?.some(
        (assignment) =>
          assignment.resourceType === ResourceType.MUSEUM &&
          assignment.resourceId === this.selectedMuseum?._id &&
          assignment.role === ContextualRole.MANAGER,
      ) ?? false
    );
  }

  // ─── Render Helpers ──────────────────────────────────────
  private renderMenuItem(item: MenuItem, collapsed = this.collapsed) {
    const isActive = this.currentRoute === item.id;
    const isDisabled = Boolean(item.requiresMuseum && !this.selectedMuseum);
    const baseClasses =
      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150';
    const activeClasses = isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
      : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-white';
    const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '';

    return html`
      <button
        @click=${() => {
          if (isDisabled) return;
          this.handleNavigate(item.id);
        }}
        class="${baseClasses} ${activeClasses} ${disabledClasses} ${collapsed
          ? 'justify-center'
          : 'w-full'}"
        aria-current=${isActive ? 'page' : 'false'}
        title=${isDisabled
          ? __('Seleziona un museo per accedere a questa sezione')
          : collapsed
            ? item.label
            : ''}
        ?disabled=${isDisabled}
      >
        <ui-icon
          name="${item.icon}"
          size="sm"
          class="${isActive ? 'text-brand-600 dark:text-brand-400' : ''}"
        ></ui-icon>
        ${!collapsed
          ? html`
              <span class="flex-1 text-left">${item.label}</span>
              ${item.badge
                ? html`
                    <span
                      class="px-2 py-0.5 text-2xs font-semibold rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                    >
                      ${item.badge}
                    </span>
                  `
                : nothing}
            `
          : nothing}
      </button>
    `;
  }

  private renderMenuSection(
    label: string,
    items: MenuItem[],
    sublabel?: string,
    collapsed = this.collapsed,
  ) {
    const userRole = this.user?.role;
    const visibleItems = items.filter((item) => {
      if (!item.roles) return true;
      if (!userRole) return false;
      return item.roles.includes(userRole);
    });

    if (visibleItems.length === 0) return null;

    return html`
      <div class="space-y-1">
        ${!collapsed
          ? html`
              <p
                class="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-surface-400"
              >
                ${label}
                ${sublabel ? html`<br /><span class="text-[0.6rem]">${sublabel}</span>` : nothing}
              </p>
            `
          : nothing}
        ${visibleItems.map((item) => this.renderMenuItem(item, collapsed))}
      </div>
    `;
  }

  private renderMainNavigation(collapsed = this.collapsed) {
    const showConfigureMuseumArea = this.canConfigureSelectedMuseum;

    return html`
      ${!collapsed && this.selectedMuseum
        ? html`
            <div
              class="px-3 py-2 rounded-lg bg-surface-100 dark:bg-surface-800 text-xs text-surface-600 dark:text-surface-300"
            >
              ${__('Museo attivo')}: <span class="font-semibold">${this.selectedMuseum.name}</span>
            </div>
          `
        : nothing}
      ${this.renderMenuItem(this.dashboardItem, collapsed)}
      ${this.renderMenuSection(__('I miei contenuti'), this.primaryMenuItems, undefined, collapsed)}
      ${showConfigureMuseumArea
        ? this.renderMenuSection(
            __('Area Curatore'),
            this.configureMuseumMenuItems,
            this.selectedMuseum?.name || '',
            collapsed,
          )
        : nothing}
      ${this.renderMenuSection(__('Area Admin'), this.adminMenuItems, undefined, collapsed)}
    `;
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    const sidebarWidth = this.collapsed ? 'w-16' : 'w-64';
    return html`
      <!-- Desktop Sidebar -->
      <aside
        class="hidden lg:flex lg:flex-col ${sidebarWidth} fixed inset-y-0 left-0 z-30 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-all duration-300"
      >
        <!-- Logo -->
        <div
          class="flex items-center ${this.collapsed
            ? 'justify-center'
            : 'gap-3 px-4'} h-16 border-b border-surface-200 dark:border-surface-800"
        >
          <ui-brand-mark .showText=${!this.collapsed}></ui-brand-mark>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
          ${this.renderMainNavigation(this.collapsed)}
        </nav>

        <!-- Bottom Section -->
        <div class="px-3 py-4 border-t border-surface-200 dark:border-surface-800 space-y-1">
          ${this.bottomItems.map((item) => this.renderMenuItem(item, this.collapsed))}

          <button
            @click=${() => this.handleNavigate('logout')}
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20 transition-colors ${this
              .collapsed
              ? 'justify-center'
              : ''}"
          >
            <ui-icon name="logout" size="sm"></ui-icon>
            ${!this.collapsed ? html`<span>${__('Esci')}</span>` : nothing}
          </button>
        </div>
      </aside>

      <!-- Mobile Overlay -->
      ${this.mobileOpen
        ? html`
            <div
              class="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in"
              @click=${() => (this.mobileOpen = false)}
            ></div>
          `
        : nothing}

      <!-- Mobile Sidebar: a differenza della versione desktop mancava
           flex-col (i figli "flex-1"/scroll non avevano un contenitore flex
           su cui agire) e overflow-y-auto sulla nav — con più di una manciata
           di voci (curatore + admin) il menu sforava il fondo dello schermo
           senza modo di scorrere fino alle ultime voci. Mancava anche del
           tutto la sezione in fondo (account/esci), presente solo su
           desktop. -->
      <aside
        class="${this.mobileOpen
          ? 'translate-x-0'
          : '-translate-x-full'} lg:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 transition-transform duration-300"
      >
        <div
          class="flex-shrink-0 flex items-center justify-between px-4 h-16 border-b border-surface-200 dark:border-surface-800"
        >
          <div class="flex items-center gap-3">
            <ui-brand-mark></ui-brand-mark>
          </div>
          <ui-icon-button
            icon="close"
            .title=${__('Apri/chiudi menu')}
            @click=${() => (this.mobileOpen = false)}
          ></ui-icon-button>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-3 overflow-y-auto">
          ${this.renderMainNavigation(false)}
        </nav>
        <div
          class="flex-shrink-0 px-3 py-4 border-t border-surface-200 dark:border-surface-800 space-y-1"
        >
          ${this.bottomItems.map((item) => this.renderMenuItem(item, false))}

          <button
            @click=${() => this.handleNavigate('logout')}
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20 transition-colors"
          >
            <ui-icon name="logout" size="sm"></ui-icon>
            <span>${__('Esci')}</span>
          </button>
        </div>
      </aside>
    `;
  }

  // ─── Public API ──────────────────────────────────────────
  public toggleMobile() {
    this.mobileOpen = !this.mobileOpen;
  }
}
