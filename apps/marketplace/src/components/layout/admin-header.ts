import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User, AppLanguage } from '@artaround/shared';
import {
  preferencesService,
  type SelectedMuseumPreference,
} from '../../services/preferences.service';
import { routerService } from '../../services/router.service';
import { museumService } from '../../services/museum.service';
import { jobsService, type Job } from '../../services/jobs.service';
import { notificationsService, type Notification } from '../../services/notifications.service';
import { modalService } from '../../services/modal.service';
import { i18nService, __ } from '../../services/i18n.service';
import '../ui/ui-icon';
import '../ui/ui-avatar';
import '../ui/ui-button';
import '../ui/ui-icon-button';
import '../ui/ui-search-bar';
import '../ui/ui-language-select';
import './accessibility-panel';

/**
 * Header fisso: titolo pagina, selettore museo, notifiche, lingua e menu utente.
 */
@customElement('admin-header')
export class AdminHeader extends LitElement {
  @property({ type: String }) title = 'Dashboard';
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) sidebarCollapsed = false;
  @state() private darkMode = false;
  @state() private infoTipsExpanded = false;
  @state() private userMenuOpen = false;
  @state() private selectedMuseum: SelectedMuseumPreference | null = null;
  @state() private canGoBack = false;
  @state() private canGoForward = false;
  @state() private a11yPanelOpen = false;
  @state() private uiLanguage: AppLanguage = i18nService.getLanguage();
  @state() private jobsPanelOpen = false;
  @state() private jobs: Job[] = jobsService.getJobs();
  @state() private cancellingJobId: string | null = null;
  @state() private notifications: Notification[] = notificationsService.getNotifications();
  @state() private resolvingRequestId: string | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.darkMode = document.documentElement.classList.contains('dark');
    this.selectedMuseum = preferencesService.getSelectedMuseum();
    void this.hydrateSelectedMuseumLocalization();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.addEventListener('route-changed', this.handleRouteChanged as EventListener);
    window.addEventListener('theme-changed', this.handleThemeChanged as EventListener);
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    window.addEventListener('jobs-changed', this.handleJobsChanged);
    window.addEventListener('notifications-changed', this.handleNotificationsChanged);
    void jobsService.refresh();
    void notificationsService.refresh();
    notificationsService.startPolling();

    // Stato iniziale dei due bottoni avanti/indietro
    this.canGoBack = routerService.canGoBack();
    this.canGoForward = routerService.canGoForward();

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (this.userMenuOpen && !(e.target as Element).closest('.user-menu')) {
        this.userMenuOpen = false;
      }
      if (this.jobsPanelOpen && !(e.target as Element).closest('.jobs-menu')) {
        this.jobsPanelOpen = false;
      }
    });
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.removeEventListener('route-changed', this.handleRouteChanged as EventListener);
    window.removeEventListener('theme-changed', this.handleThemeChanged as EventListener);
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    window.removeEventListener('jobs-changed', this.handleJobsChanged);
    window.removeEventListener('notifications-changed', this.handleNotificationsChanged);
    super.disconnectedCallback();
  }

  // ─── Azioni e gestori eventi ───────────────────────────
  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
    void this.hydrateSelectedMuseumLocalization();
  };

  private handleRouteChanged = (
    event: CustomEvent<{ canGoBack: boolean; canGoForward: boolean }>,
  ) => {
    this.canGoBack = event.detail.canGoBack;
    this.canGoForward = event.detail.canGoForward;
  };

  private handleThemeChanged = (_event: CustomEvent) => {
    this.darkMode = document.documentElement.classList.contains('dark');
  };

  private handleLanguageChanged = (event: CustomEvent<{ language: AppLanguage }>) => {
    this.uiLanguage = event.detail?.language || i18nService.getLanguage();
  };

  private handleJobsChanged = (e: Event): void => {
    this.jobs = (e as CustomEvent<Job[]>).detail;
  };

  private async handleCancelJob(id: string): Promise<void> {
    this.cancellingJobId = id;
    try {
      await jobsService.cancelJob(id);
    } finally {
      this.cancellingJobId = null;
    }
  }

  private handleNotificationsChanged = (e: Event): void => {
    this.notifications = (e as CustomEvent<Notification[]>).detail;
  };

  private get notificationBadgeCount(): number {
    const activeJobs = this.jobs.filter((job) => job.status === 'running').length;
    const unread = this.notifications.filter((n) => !n.read).length;
    return activeJobs + unread;
  }

  private async handleApproveRoleRequest(notification: Notification): Promise<void> {
    if (!notification.roleRequest) return;
    const { museumId, requestId } = notification.roleRequest;
    this.resolvingRequestId = notification._id;
    try {
      await museumService.approveRoleRequest(museumId, requestId);
      await notificationsService.refresh();
    } finally {
      this.resolvingRequestId = null;
    }
  }

  private async handleRejectRoleRequest(notification: Notification): Promise<void> {
    if (!notification.roleRequest) return;

    const confirmed = await modalService.confirm({
      title: __('Rifiutare la richiesta?'),
      message: notification.message,
      variant: 'danger',
      confirmLabel: __('Rifiuta'),
      cancelLabel: __('Annulla'),
    });
    if (!confirmed) return;

    const { museumId, requestId } = notification.roleRequest;
    this.resolvingRequestId = notification._id;
    try {
      await museumService.cancelRoleRequest(museumId, requestId);
      await notificationsService.refresh();
    } finally {
      this.resolvingRequestId = null;
    }
  }

  private async handleMarkNotificationRead(id: string): Promise<void> {
    await notificationsService.markRead(id);
  }

  private formatNotificationDate(createdAt: string): string {
    return new Date(createdAt).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private jobTypeLabel(job: Job): string {
    switch (job.type) {
      case 'generate-audio':
        return job.visitId ? __('Generazione audio — una visita') : __('Generazione audio — museo');
      case 'sync-languages':
        return job.visitId
          ? __('Sincronizzazione lingue — una visita')
          : __('Sincronizzazione lingue — museo');
      default:
        return job.type;
    }
  }

  private jobStatusLabel(job: Job): string {
    switch (job.status) {
      case 'running':
        return __('In corso');
      case 'completed':
        return __('Completato');
      case 'failed':
        return __('Fallito');
      case 'cancelled':
        return __('Interrotto');
    }
  }

  private jobProgressSummary(job: Job): string {
    const { items, visitSteps } = job.progress;
    // "visitSteps" è condiviso tra i due job: conta tappe per l'audio, visite intere per le lingue.
    const secondBucketLabel = job.type === 'sync-languages' ? 'Visite' : 'Tappe';
    return `Contenuti: ${items.generated}/${items.scanned} generati (${items.failed} falliti) — ${secondBucketLabel}: ${visitSteps.generated}/${visitSteps.scanned}`;
  }

  private jobElapsedLabel(job: Job): string {
    const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
    const minutes = Math.max(0, Math.round((end - new Date(job.startedAt).getTime()) / 60000));
    if (minutes < 1) return 'meno di un minuto';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours}h ${rest}min`;
  }

  // Chiama la history vera del browser: il popstate arriva al router che applica lo stato da sé.
  private handleHistoryBack() {
    window.history.back();
  }

  private handleHistoryForward() {
    window.history.forward();
  }

  private toggleDarkMode() {
    const newTheme = this.darkMode ? 'light' : 'dark';
    preferencesService.setTheme(newTheme);
  }

  // Apre/chiude in blocco tutti i box informativi "inline" della pagina — le singole
  // istanze restano comunque apribili una per una. Vedi ui-info-tip.ts.
  private toggleAllInfoTips() {
    this.infoTipsExpanded = !this.infoTipsExpanded;
    window.dispatchEvent(
      new CustomEvent('info-tips-visibility-changed', {
        detail: { expanded: this.infoTipsExpanded },
      }),
    );
  }

  private handleMenuToggle() {
    this.dispatchEvent(new CustomEvent('menu-toggle', { bubbles: true, composed: true }));
  }

  private handleSidebarToggle() {
    this.dispatchEvent(new CustomEvent('sidebar-toggle', { bubbles: true, composed: true }));
  }

  private handleSelectMuseum() {
    this.dispatchEvent(new CustomEvent('select-museum', { bubbles: true, composed: true }));
  }

  private handleClearMuseum() {
    preferencesService.clearSelectedMuseum();
  }

  private handleGoToAccount() {
    this.userMenuOpen = false;
    this.dispatchEvent(
      new CustomEvent('navigate', {
        detail: { route: 'settings' },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async hydrateSelectedMuseumLocalization() {
    if (!this.selectedMuseum?._id) {
      return;
    }

    const hasTranslations =
      this.selectedMuseum.nameTranslations &&
      Object.keys(this.selectedMuseum.nameTranslations).length > 0;

    if (hasTranslations) {
      return;
    }

    try {
      const museum = await museumService.getMuseum(this.selectedMuseum._id);
      if (!museum) {
        return;
      }

      const localizedPreference: SelectedMuseumPreference = {
        _id: museum._id,
        wikidataId: museum.wikidataId,
        name: museum.name,
        nameTranslations: museum.nameTranslations,
      };

      this.selectedMuseum = localizedPreference;
      preferencesService.setSelectedMuseum(localizedPreference);
    } catch {
      // ignore hydration errors, fallback remains base name
    }
  }

  private getLocalizedSelectedMuseumName(): string {
    if (!this.selectedMuseum) {
      return __('Seleziona museo');
    }

    const currentLanguage = i18nService.getLanguage();
    if (currentLanguage === 'it') {
      return this.selectedMuseum.name;
    }

    return this.selectedMuseum.nameTranslations?.[currentLanguage] || this.selectedMuseum.name;
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    const marginLeft = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <header
        class="fixed top-0 right-0 left-0 ${marginLeft} z-20 h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 transition-all duration-300"
      >
        <div class="flex items-center justify-between h-full px-4 lg:px-6">
          <div class="flex items-center gap-4">
            <ui-icon-button
              @click=${this.handleMenuToggle}
              class="lg:hidden"
              icon="menu"
              .title=${__('Apri/chiudi menu')}
            ></ui-icon-button>
            <ui-icon-button
              @click=${this.handleSidebarToggle}
              class="hidden lg:inline-flex"
              icon="menu"
              .title=${__('Comprimi/espandi sidebar')}
            ></ui-icon-button>

            <div class="hidden lg:flex items-center gap-1">
              <ui-icon-button
                @click=${this.handleHistoryBack}
                icon="arrow-left"
                .title=${__('Indietro')}
                ?disabled=${!this.canGoBack}
                class="${!this.canGoBack ? 'opacity-40 cursor-not-allowed' : ''}"
              ></ui-icon-button>
              <ui-icon-button
                @click=${this.handleHistoryForward}
                icon="arrow-right"
                .title=${__('Avanti')}
                ?disabled=${!this.canGoForward}
                class="${!this.canGoForward ? 'opacity-40 cursor-not-allowed' : ''}"
              ></ui-icon-button>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="hidden lg:flex items-center gap-1">
              <ui-button
                variant="secondary"
                size="sm"
                icon="museum"
                .label=${this.getLocalizedSelectedMuseumName()}
                @click=${this.handleSelectMuseum}
              ></ui-button>
              ${this.selectedMuseum
                ? html`
                    <ui-icon-button
                      icon="x"
                      .title=${__('Deseleziona museo')}
                      @click=${this.handleClearMuseum}
                    ></ui-icon-button>
                  `
                : nothing}
            </div>

            <div class="lg:hidden flex items-center gap-1">
              <ui-icon-button
                icon="museum"
                .title=${this.getLocalizedSelectedMuseumName()}
                @click=${this.handleSelectMuseum}
              ></ui-icon-button>
              ${this.selectedMuseum
                ? html`
                    <ui-icon-button
                      icon="x"
                      .title=${__('Deseleziona museo')}
                      @click=${this.handleClearMuseum}
                    ></ui-icon-button>
                  `
                : nothing}
            </div>

            ${this.user
              ? html`
                  <button
                    @click=${this.handleGoToAccount}
                    class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success-50 dark:bg-surface-800 text-success-700 dark:text-success-500 hover:bg-success-100 dark:hover:bg-surface-700 transition-colors text-sm font-semibold"
                    title=${__('Il mio credito')}
                  >
                    <ui-icon name="euro" size="xs"></ui-icon>
                    <span>€${(this.user.creditBalance ?? 0).toFixed(2)}</span>
                  </button>
                `
              : nothing}

            <div class="relative jobs-menu">
              <div class="relative">
                <ui-icon-button
                  icon="bell"
                  size="sm"
                  .title=${__('Notifiche')}
                  @click=${() => (this.jobsPanelOpen = !this.jobsPanelOpen)}
                ></ui-icon-button>
                ${this.notificationBadgeCount > 0
                  ? html`
                      <span
                        class="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[1rem] h-4 px-1 rounded-full bg-danger-500 text-white text-[10px] font-semibold leading-none pointer-events-none"
                      >
                        ${this.notificationBadgeCount > 9 ? '9+' : this.notificationBadgeCount}
                      </span>
                    `
                  : nothing}
              </div>

              ${this.jobsPanelOpen
                ? html`
                    <div
                      class="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-w-[calc(100vw-2rem)] max-h-[28rem] overflow-y-auto rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-strong animate-scale-in origin-top-right"
                    >
                      <div class="p-3 border-b border-surface-200 dark:border-surface-700">
                        <p class="text-sm font-medium text-surface-900 dark:text-white">
                          ${__('Processi in background')}
                        </p>
                      </div>
                      ${this.jobs.length === 0
                        ? html`
                            <p class="p-4 text-sm text-surface-500 dark:text-surface-400">
                              ${__('Nessun processo recente')}
                            </p>
                          `
                        : html`
                            <ul class="p-1.5 space-y-1">
                              ${this.jobs.map(
                                (job) => html`
                                  <li class="p-2.5 rounded-md text-sm">
                                    <div class="flex items-center justify-between gap-2">
                                      <span
                                        class="font-medium text-surface-800 dark:text-surface-100"
                                        >${this.jobTypeLabel(job)}</span
                                      >
                                      <span
                                        class="${job.status === 'running'
                                          ? 'text-primary-600 dark:text-primary-400'
                                          : job.status === 'failed'
                                            ? 'text-danger-600 dark:text-danger-400'
                                            : 'text-surface-500 dark:text-surface-400'} text-xs font-medium"
                                        >${this.jobStatusLabel(job)}</span
                                      >
                                    </div>
                                    <p class="mt-1 text-xs text-surface-500 dark:text-surface-400">
                                      ${this.jobProgressSummary(job)}
                                    </p>
                                    <p
                                      class="mt-0.5 text-xs text-surface-400 dark:text-surface-500"
                                    >
                                      ${job.status === 'running' ? __('Da') : __('Durata')}:
                                      ${this.jobElapsedLabel(job)}
                                    </p>
                                    ${job.error
                                      ? html`<p
                                          class="mt-1 text-xs text-danger-600 dark:text-danger-400"
                                        >
                                          ${job.error}
                                        </p>`
                                      : nothing}
                                    ${job.status === 'running'
                                      ? html`
                                          <button
                                            @click=${() => this.handleCancelJob(job._id)}
                                            ?disabled=${this.cancellingJobId === job._id}
                                            class="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400 hover:underline disabled:opacity-50"
                                          >
                                            ${this.cancellingJobId === job._id
                                              ? __('Interruzione…')
                                              : __('Ferma')}
                                          </button>
                                        `
                                      : nothing}
                                  </li>
                                `,
                              )}
                            </ul>
                          `}

                      <div class="p-3 border-t border-b border-surface-200 dark:border-surface-700">
                        <p class="text-sm font-medium text-surface-900 dark:text-white">
                          ${__('Notifiche')}
                        </p>
                      </div>
                      ${this.notifications.length === 0
                        ? html`
                            <p class="p-4 text-sm text-surface-500 dark:text-surface-400">
                              ${__('Nessuna notifica')}
                            </p>
                          `
                        : html`
                            <ul class="p-1.5 space-y-1">
                              ${this.notifications.map(
                                (notification) => html`
                                  <li
                                    class="p-2.5 rounded-md text-sm ${!notification.read
                                      ? 'bg-brand-50/60 dark:bg-brand-900/10'
                                      : ''}"
                                    @click=${() =>
                                      !notification.read &&
                                      this.handleMarkNotificationRead(notification._id)}
                                  >
                                    <p class="font-medium text-surface-800 dark:text-surface-100">
                                      ${notification.title}
                                    </p>
                                    <p
                                      class="mt-0.5 text-xs text-surface-500 dark:text-surface-400"
                                    >
                                      ${notification.message}
                                    </p>
                                    <p
                                      class="mt-0.5 text-xs text-surface-400 dark:text-surface-500"
                                    >
                                      ${this.formatNotificationDate(notification.createdAt)}
                                    </p>
                                    ${notification.kind === 'role-request-pending' &&
                                    notification.roleRequest
                                      ? html`
                                          <div class="mt-1.5 flex items-center gap-3">
                                            <button
                                              @click=${(e: Event) => {
                                                e.stopPropagation();
                                                this.handleApproveRoleRequest(notification);
                                              }}
                                              ?disabled=${this.resolvingRequestId ===
                                              notification._id}
                                              class="text-xs font-medium text-success-600 dark:text-success-400 hover:underline disabled:opacity-50"
                                            >
                                              ${__('Approva')}
                                            </button>
                                            <button
                                              @click=${(e: Event) => {
                                                e.stopPropagation();
                                                this.handleRejectRoleRequest(notification);
                                              }}
                                              ?disabled=${this.resolvingRequestId ===
                                              notification._id}
                                              class="text-xs font-medium text-danger-600 dark:text-danger-400 hover:underline disabled:opacity-50"
                                            >
                                              ${__('Rifiuta')}
                                            </button>
                                          </div>
                                        `
                                      : nothing}
                                  </li>
                                `,
                              )}
                            </ul>
                          `}
                    </div>
                  `
                : nothing}
            </div>

            <ui-icon-button
              @click=${this.toggleAllInfoTips}
              icon="info"
              variant=${this.infoTipsExpanded ? 'brand' : 'default'}
              .title=${this.infoTipsExpanded
                ? __('Nascondi tutte le info')
                : __('Mostra tutte le info')}
              class="hidden lg:inline-flex"
            ></ui-icon-button>

            <ui-icon-button
              @click=${this.toggleDarkMode}
              icon="${this.darkMode ? 'sun' : 'moon'}"
              .title=${__('Cambia tema')}
              class="hidden lg:inline-flex"
            ></ui-icon-button>
            <ui-icon-button
              @click=${() => (this.a11yPanelOpen = true)}
              icon="accessibility"
              .title=${__('Impostazioni accessibilità')}
              class="hidden lg:inline-flex"
            ></ui-icon-button>
            <ui-language-select
              compact
              align="right"
              .value=${this.uiLanguage}
              @select-change=${(e: CustomEvent) =>
                i18nService.setLanguage((e.detail.value || 'it') as AppLanguage)}
            ></ui-language-select>
            <div class="relative user-menu">
              <button
                @click=${() => (this.userMenuOpen = !this.userMenuOpen)}
                class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <ui-avatar
                  initials="${this.user?.username
                    ?.split(' ')
                    .map((n: string) => n[0])
                    .join('') || 'U'}"
                  size="sm"
                ></ui-avatar>
                <span
                  class="hidden sm:block text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  ${this.user?.username || __('Utente')}
                </span>
                <ui-icon name="chevron-down" size="xs" class="text-surface-400"></ui-icon>
              </button>
              ${this.userMenuOpen
                ? html`
                    <div
                      class="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-strong animate-scale-in origin-top-right"
                    >
                      <div class="p-3 border-b border-surface-200 dark:border-surface-700">
                        <p class="text-sm font-medium text-surface-900 dark:text-white">
                          ${this.user?.username}
                        </p>
                        <p class="text-xs text-surface-500">${this.user?.email}</p>
                      </div>
                      <div class="p-1.5">
                        ${this.user
                          ? html`
                              <button
                                @click=${this.handleGoToAccount}
                                class="lg:hidden flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-success-700 dark:text-success-500 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                              >
                                <ui-icon name="euro" size="xs"></ui-icon>
                                ${__('Credito')}: €${(this.user.creditBalance ?? 0).toFixed(2)}
                              </button>
                            `
                          : nothing}
                        <button
                          @click=${this.handleGoToAccount}
                          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                        >
                          <ui-icon name="cog" size="xs"></ui-icon>
                          ${__('Il mio account')}
                        </button>

                        <button
                          @click=${this.toggleAllInfoTips}
                          class="lg:hidden flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                        >
                          <ui-icon name="info" size="xs"></ui-icon>
                          ${this.infoTipsExpanded
                            ? __('Nascondi tutte le info')
                            : __('Mostra tutte le info')}
                        </button>
                        <button
                          @click=${this.toggleDarkMode}
                          class="lg:hidden flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                        >
                          <ui-icon name="${this.darkMode ? 'sun' : 'moon'}" size="xs"></ui-icon>
                          ${this.darkMode ? __('Tema chiaro') : __('Tema scuro')}
                        </button>
                        <button
                          @click=${() => {
                            this.userMenuOpen = false;
                            this.a11yPanelOpen = true;
                          }}
                          class="lg:hidden flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                        >
                          <ui-icon name="accessibility" size="xs"></ui-icon>
                          ${__('Accessibilità')}
                        </button>

                        <button
                          @click=${() =>
                            this.dispatchEvent(
                              new CustomEvent('logout', { bubbles: true, composed: true }),
                            )}
                          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md transition-colors"
                        >
                          <ui-icon name="logout" size="xs"></ui-icon>
                          ${__('Esci')}
                        </button>
                      </div>
                    </div>
                  `
                : nothing}
            </div>
          </div>
        </div>
      </header>
      <accessibility-panel
        .open=${this.a11yPanelOpen}
        @panel-close=${() => (this.a11yPanelOpen = false)}
      ></accessibility-panel>
    `;
  }
}
