import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { User, AppLanguage } from '@artaround/shared';
import {
  preferencesService,
  type SelectedMuseumPreference,
} from '../../services/preferences.service';
import { historyService } from '../../services/history.service';
import { museumService } from '../../services/museum.service';
import { i18nService, __ } from '../../services/i18n.service';
import '../ui/ui-icon';
import '../ui/ui-avatar';
import '../ui/ui-button';
import '../ui/ui-icon-button';
import '../ui/ui-search-bar';
import '../ui/ui-language-select';
import './accessibility-panel';

@customElement('admin-header')
export class AdminHeader extends LitElement {
  @property({ type: String }) title = 'Dashboard';
  @property({ type: Object }) user: User | null = null;
  @property({ type: Boolean }) sidebarCollapsed = false;
  @state() private darkMode = false;
  @state() private userMenuOpen = false;
  @state() private selectedMuseum: SelectedMuseumPreference | null = null;
  @state() private canGoBack = false;
  @state() private canGoForward = false;
  @state() private a11yPanelOpen = false;
  @state() private uiLanguage: AppLanguage = i18nService.getLanguage();

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.darkMode = document.documentElement.classList.contains('dark');
    this.selectedMuseum = preferencesService.getSelectedMuseum();
    void this.hydrateSelectedMuseumLocalization();
    window.addEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.addEventListener('history-state-changed', this.handleHistoryChanged as EventListener);
    window.addEventListener('theme-changed', this.handleThemeChanged as EventListener);
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);

    // Initialize history state
    this.canGoBack = historyService.canGoBack();
    this.canGoForward = historyService.canGoForward();

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (this.userMenuOpen && !(e.target as Element).closest('.user-menu')) {
        this.userMenuOpen = false;
      }
    });
  }

  disconnectedCallback() {
    window.removeEventListener('museum-changed', this.handleMuseumChanged as EventListener);
    window.removeEventListener('history-state-changed', this.handleHistoryChanged as EventListener);
    window.removeEventListener('theme-changed', this.handleThemeChanged as EventListener);
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    super.disconnectedCallback();
  }

  // ─── Actions & Event Handlers ───────────────────────────
  private handleMuseumChanged = (event: CustomEvent) => {
    this.selectedMuseum = event.detail || null;
    void this.hydrateSelectedMuseumLocalization();
  };

  private handleHistoryChanged = (event: CustomEvent) => {
    this.canGoBack = event.detail.canGoBack;
    this.canGoForward = event.detail.canGoForward;
  };

  private handleThemeChanged = (_event: CustomEvent) => {
    this.darkMode = document.documentElement.classList.contains('dark');
  };

  private handleLanguageChanged = (event: CustomEvent<{ language: AppLanguage }>) => {
    this.uiLanguage = event.detail?.language || i18nService.getLanguage();
  };

  private handleHistoryBack() {
    this.dispatchEvent(new CustomEvent('history-back', { bubbles: true, composed: true }));
  }

  private handleHistoryForward() {
    this.dispatchEvent(new CustomEvent('history-forward', { bubbles: true, composed: true }));
  }

  private toggleDarkMode() {
    const newTheme = this.darkMode ? 'light' : 'dark';
    preferencesService.setTheme(newTheme);
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

  // ─── Render Entry ────────────────────────────────────────
  render() {
    const marginLeft = this.sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64';

    return html`
      <header
        class="fixed top-0 right-0 left-0 ${marginLeft} z-20 h-16 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 transition-all duration-300"
      >
        <div class="flex items-center justify-between h-full px-4 lg:px-6">
          <!-- Left Section -->
          <div class="flex items-center gap-4">
            <!-- Mobile Menu Button -->
            <ui-icon-button
              @click=${this.handleMenuToggle}
              class="lg:hidden"
              icon="menu"
              .title=${__('Apri/chiudi menu')}
            ></ui-icon-button>

            <!-- Sidebar Collapse Button (Desktop) -->
            <ui-icon-button
              @click=${this.handleSidebarToggle}
              class="hidden lg:inline-flex"
              icon="menu"
              .title=${__('Comprimi/espandi sidebar')}
            ></ui-icon-button>

            <!-- History Navigation -->
            <div class="flex items-center gap-1">
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

          <!-- Right Section -->
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

            <!-- Theme Toggle -->
            <ui-icon-button
              @click=${this.toggleDarkMode}
              icon="${this.darkMode ? 'sun' : 'moon'}"
              .title=${__('Cambia tema')}
            ></ui-icon-button>

            <!-- Accessibility -->
            <ui-icon-button
              @click=${() => (this.a11yPanelOpen = true)}
              icon="accessibility"
              .title=${__('Impostazioni accessibilità')}
            ></ui-icon-button>

            <!-- Language Selector -->
            <ui-language-select
              compact
              align="right"
              .value=${this.uiLanguage}
              @select-change=${(e: CustomEvent) =>
                i18nService.setLanguage((e.detail.value || 'it') as AppLanguage)}
            ></ui-language-select>

            <!-- User Menu -->
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

              <!-- Dropdown -->
              ${this.userMenuOpen
                ? html`
                    <div
                      class="absolute right-0 top-full mt-2 w-56 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-strong animate-scale-in origin-top-right"
                    >
                      <div class="p-3 border-b border-surface-200 dark:border-surface-700">
                        <p class="text-sm font-medium text-surface-900 dark:text-white">
                          ${this.user?.username}
                        </p>
                        <p class="text-xs text-surface-500">${this.user?.email}</p>
                      </div>
                      <div class="p-1.5">
                        <button
                          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-md transition-colors"
                        >
                          <ui-icon name="cog" size="xs"></ui-icon>
                          ${__('Impostazioni')}
                        </button>
                        <button
                          @click=${() =>
                            this.dispatchEvent(
                              new CustomEvent('logout', { bubbles: true, composed: true }),
                            )}
                          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md transition-colors"
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

      <!-- Accessibility Panel (rendered outside header for z-index stacking) -->
      <accessibility-panel
        .open=${this.a11yPanelOpen}
        @panel-close=${() => (this.a11yPanelOpen = false)}
      ></accessibility-panel>
    `;
  }
}
