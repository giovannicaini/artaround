import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  preferencesService,
  type AccessibilitySettings,
  type Theme,
} from '../../services/preferences.service';
import '../ui/ui-icon';
import '../ui/ui-icon-button';

@customElement('accessibility-panel')
export class AccessibilityPanel extends LitElement {
  @property({ type: Boolean }) open = false;
  @state() private settings: AccessibilitySettings = preferencesService.getAccessibility();
  @state() private theme: Theme = preferencesService.getTheme();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('accessibility-changed', this.handleA11yChanged as EventListener);
    window.addEventListener('theme-changed', this.handleThemeChanged as EventListener);
    document.addEventListener('keydown', this.handleKeyDown as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('accessibility-changed', this.handleA11yChanged as EventListener);
    window.removeEventListener('theme-changed', this.handleThemeChanged as EventListener);
    document.removeEventListener('keydown', this.handleKeyDown as EventListener);
    super.disconnectedCallback();
  }

  private handleA11yChanged = (e: CustomEvent) => {
    this.settings = { ...e.detail };
  };

  private handleThemeChanged = (e: CustomEvent) => {
    this.theme = e.detail;
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) {
      this.close();
    }
  };

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('panel-close', { bubbles: true, composed: true }));
  }

  private setTheme(theme: Theme) {
    preferencesService.setTheme(theme);
    this.theme = theme;
  }

  private toggleSetting(key: keyof AccessibilitySettings) {
    const current = this.settings[key];
    preferencesService.setAccessibility({ [key]: !current });
    this.settings = { ...this.settings, [key]: !current };
  }

  private setFontSize(size: AccessibilitySettings['fontSize']) {
    preferencesService.setAccessibility({ fontSize: size });
    this.settings = { ...this.settings, fontSize: size };
  }

  private setLetterSpacing(spacing: AccessibilitySettings['letterSpacing']) {
    preferencesService.setAccessibility({ letterSpacing: spacing });
    this.settings = { ...this.settings, letterSpacing: spacing };
  }

  private resetAll() {
    const defaults: AccessibilitySettings = {
      reduceMotion: false,
      highContrast: false,
      fontSize: 'normal',
      letterSpacing: 'normal',
      dyslexicFont: false,
      underlineLinks: false,
      focusVisible: false,
    };
    preferencesService.setAccessibility(defaults);
    this.settings = { ...defaults };
    preferencesService.setTheme('auto');
    this.theme = 'auto';
  }

  private renderToggleRow(
    label: string,
    description: string,
    icon: string,
    key: keyof AccessibilitySettings,
  ) {
    const value = this.settings[key] as boolean;
    return html`
      <div
        class="flex items-center justify-between py-3 border-b border-surface-100 dark:border-surface-700 last:border-0"
      >
        <div class="flex items-start gap-3">
          <div
            class="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-100 dark:bg-surface-800 flex-shrink-0 mt-0.5"
          >
            <ui-icon
              name="${icon}"
              size="sm"
              class="text-surface-500 dark:text-surface-400"
            ></ui-icon>
          </div>
          <div>
            <p class="text-sm font-medium text-surface-900 dark:text-white">${label}</p>
            <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">${description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked="${value}"
          @click=${() => this.toggleSetting(key)}
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${value
            ? 'bg-brand-500'
            : 'bg-surface-200 dark:bg-surface-600'}"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value
              ? 'translate-x-5'
              : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    `;
  }

  render() {
    if (!this.open) return html``;

    return html`
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        @click=${this.close}
        aria-hidden="true"
      ></div>

      <!-- Panel -->
      <div
        role="dialog"
        aria-label="Impostazioni accessibilità"
        class="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-surface-900 shadow-2xl flex flex-col animate-slide-left"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700"
        >
          <div class="flex items-center gap-2">
            <ui-icon name="accessibility" size="sm" class="text-brand-500"></ui-icon>
            <h2 class="text-base font-semibold text-surface-900 dark:text-white">Accessibilità</h2>
          </div>
          <ui-icon-button icon="x" @click=${this.close} title="Chiudi pannello"></ui-icon-button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-5 space-y-6">
          <!-- TEMA -->
          <section>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3"
            >
              Tema
            </h3>
            <div class="grid grid-cols-3 gap-2">
              ${(['light', 'auto', 'dark'] as Theme[]).map((t) => {
                const labels: Record<Theme, string> = {
                  light: 'Chiaro',
                  auto: 'Auto',
                  dark: 'Scuro',
                };
                const icons: Record<Theme, string> = {
                  light: 'sun',
                  auto: 'monitor',
                  dark: 'moon',
                };
                const active = this.theme === t;
                return html`
                  <button
                    type="button"
                    @click=${() => this.setTheme(t)}
                    class="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all text-sm font-medium
                      ${active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'}"
                  >
                    <ui-icon name="${icons[t]}" size="sm"></ui-icon>
                    ${labels[t]}
                  </button>
                `;
              })}
            </div>
          </section>

          <!-- DIMENSIONE FONT -->
          <section>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3"
            >
              Dimensione testo
            </h3>
            <div class="grid grid-cols-3 gap-2">
              ${(
                [
                  ['normal', 'Aa', 'Normal'],
                  ['large', 'Aa', 'Grande'],
                  ['xlarge', 'Aa', 'Extra'],
                ] as [AccessibilitySettings['fontSize'], string, string][]
              ).map(([size, sample, label]) => {
                const active = this.settings.fontSize === size;
                const textSizes: Record<string, string> = {
                  normal: 'text-sm',
                  large: 'text-base',
                  xlarge: 'text-lg',
                };
                return html`
                  <button
                    type="button"
                    @click=${() => this.setFontSize(size)}
                    class="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 transition-all font-medium
                        ${active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'}"
                  >
                    <span class="${textSizes[size]} font-bold">${sample}</span>
                    <span class="text-xs">${label}</span>
                  </button>
                `;
              })}
            </div>
          </section>

          <!-- SPAZIATURA TESTO -->
          <section>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3"
            >
              Spaziature testo
            </h3>
            <div class="grid grid-cols-2 gap-2">
              ${(
                [
                  ['normal', 'Normale'],
                  ['wide', 'Spaziata'],
                ] as [AccessibilitySettings['letterSpacing'], string][]
              ).map(([spacing, label]) => {
                const active = this.settings.letterSpacing === spacing;
                return html`
                  <button
                    type="button"
                    @click=${() => this.setLetterSpacing(spacing)}
                    class="flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 transition-all text-sm font-medium
                        ${active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                      : 'border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:border-surface-300 dark:hover:border-surface-600'}"
                  >
                    <span
                      class="${spacing === 'wide'
                        ? 'tracking-widest'
                        : 'tracking-normal'} font-semibold"
                      >A B C</span
                    >
                    <span class="text-xs">${label}</span>
                  </button>
                `;
              })}
            </div>
          </section>

          <!-- TOGGLE SETTINGS -->
          <section>
            <h3
              class="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500 mb-3"
            >
              Opzioni visive
            </h3>
            <div
              class="rounded-xl border border-surface-200 dark:border-surface-700 px-4 divide-y divide-surface-100 dark:divide-surface-700"
            >
              ${this.renderToggleRow(
                'Alto contrasto',
                'Aumenta il contrasto tra testo e sfondo',
                'eye',
                'highContrast',
              )}
              ${this.renderToggleRow(
                'Riduci animazioni',
                'Disabilita transizioni ed effetti di movimento',
                'zap',
                'reduceMotion',
              )}
              ${this.renderToggleRow(
                'Font dislessici',
                'Usa OpenDyslexic, più facile da leggere',
                'text',
                'dyslexicFont',
              )}
              ${this.renderToggleRow(
                'Sottolinea i link',
                'Rende i link sempre riconoscibili',
                'link',
                'underlineLinks',
              )}
              ${this.renderToggleRow(
                'Focus ben visibile',
                'Outline più marcato su tastiera e tab',
                'focus',
                'focusVisible',
              )}
            </div>
          </section>
        </div>

        <!-- Footer -->
        <div class="px-5 py-4 border-t border-surface-200 dark:border-surface-700">
          <button
            type="button"
            @click=${this.resetAll}
            class="w-full py-2 px-4 text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg transition-colors"
          >
            Ripristina impostazioni predefinite
          </button>
        </div>
      </div>
    `;
  }
}
