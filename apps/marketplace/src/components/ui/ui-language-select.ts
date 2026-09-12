import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { APP_LANGUAGE_META, type AppLanguage } from '@artaround/shared';
import { __ } from '../../services/i18n.service';
import './ui-icon';

@customElement('ui-language-select')
export class UiLanguageSelect extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) value: AppLanguage = 'it';
  @property({ type: Array }) languages: AppLanguage[] = ['it', 'en', 'fr', 'de', 'es'];
  @property({ type: String }) size: 'sm' | 'md' = 'sm';
  @property({ type: Boolean }) compact = false;
  @property({ type: String }) align: 'left' | 'right' = 'left';
  @property({ type: Boolean }) disabled = false;

  @state() private open = false;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    document.addEventListener('click', this.handleOutsideClick as EventListener);
    window.addEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this.handleOutsideClick as EventListener);
    window.removeEventListener('ui-language-changed', this.handleLanguageChanged as EventListener);
    super.disconnectedCallback();
  }

  private handleOutsideClick = (event: Event) => {
    if (!this.open) return;
    if (!this.contains(event.target as Node)) {
      this.open = false;
    }
  };

  private handleLanguageChanged = (_event: CustomEvent<{ language: AppLanguage }>) => {
    this.requestUpdate();
  };

  private get languageOptions(): Array<{ value: AppLanguage; label: string; flagCode: string }> {
    const toOption = (lang: AppLanguage) => {
      const meta = APP_LANGUAGE_META[lang];
      return { value: lang, label: __(meta.label), flagCode: meta.flagCode };
    };

    const uniqueLanguages = Array.from(new Set(this.languages)).filter(
      (lang): lang is AppLanguage => lang in APP_LANGUAGE_META,
    );

    return uniqueLanguages.length > 0 ? uniqueLanguages.map(toOption) : [toOption('it')];
  }

  private get selectedOption() {
    return (
      this.languageOptions.find((option) => option.value === this.value) || this.languageOptions[0]
    );
  }

  private flagUrl(code: string): string {
    return `https://flagcdn.com/20x15/${code}.png`;
  }

  private selectLanguage(lang: AppLanguage): void {
    if (this.disabled) return;
    this.value = lang;
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('select-change', {
        detail: { value: lang },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (this.compact) {
      return this.renderCompact();
    }

    const sizeClass =
      this.size === 'sm' ? 'h-9 min-w-[130px] text-sm px-2.5' : 'h-10 min-w-[150px] text-sm px-3';

    return html`
      <div class="space-y-1.5 relative">
        ${this.label
          ? html`<label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
              ${this.label}
            </label>`
          : nothing}

        <button
          type="button"
          class="${sizeClass} w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors flex items-center justify-between gap-2 ${this
            .disabled
            ? 'opacity-60 cursor-not-allowed'
            : ''}"
          @click=${() => {
            if (this.disabled) return;
            this.open = !this.open;
          }}
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          ?disabled=${this.disabled}
          .title=${__('Cambia lingua')}
        >
          <span class="flex items-center gap-2 min-w-0">
            <img
              src=${this.flagUrl(this.selectedOption.flagCode)}
              alt=${this.selectedOption.label}
              width="20"
              height="15"
              class="rounded-sm border border-surface-200 dark:border-surface-700"
              loading="lazy"
            />
            <span class="truncate">${this.selectedOption.label}</span>
          </span>
          <ui-icon
            name=${this.open ? 'chevron-up' : 'chevron-down'}
            size="xs"
            class="text-surface-400"
          ></ui-icon>
        </button>

        ${this.open
          ? html`
              <div
                class="absolute left-0 right-0 top-full mt-1 rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-lg z-50 overflow-hidden"
                role="listbox"
              >
                ${this.languageOptions.map(
                  (option) => html`
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 ${option.value ===
                      this.value
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700'}"
                      @click=${() => this.selectLanguage(option.value)}
                    >
                      <img
                        src=${this.flagUrl(option.flagCode)}
                        alt=${option.label}
                        width="20"
                        height="15"
                        class="rounded-sm border border-surface-200 dark:border-surface-700"
                        loading="lazy"
                      />
                      <span>${option.label}</span>
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderCompact() {
    return html`
      <div class="relative">
        <button
          type="button"
          class="h-9 w-9 rounded-lg  bg-white dark:bg-surface-900 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors inline-flex items-center justify-center ${this
            .disabled
            ? 'opacity-60 cursor-not-allowed'
            : ''}"
          @click=${() => {
            if (this.disabled) return;
            this.open = !this.open;
          }}
          aria-haspopup="listbox"
          aria-expanded=${this.open ? 'true' : 'false'}
          ?disabled=${this.disabled}
          .title=${__('Cambia lingua')}
        >
          <img
            src=${this.flagUrl(this.selectedOption.flagCode)}
            alt=${this.selectedOption.label}
            width="20"
            height="15"
            class="rounded-sm"
            loading="lazy"
          />
        </button>

        ${this.open
          ? html`
              <div
                class="absolute ${this.align === 'right'
                  ? 'right-0'
                  : 'left-0'} top-full mt-1 min-w-[170px] rounded-lg bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-lg z-50 overflow-hidden"
                role="listbox"
              >
                ${this.languageOptions.map(
                  (option) => html`
                    <button
                      type="button"
                      class="w-full px-3 py-2 text-sm text-left transition-colors flex items-center gap-2 ${option.value ===
                      this.value
                        ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700'}"
                      @click=${() => this.selectLanguage(option.value)}
                    >
                      <img
                        src=${this.flagUrl(option.flagCode)}
                        alt=${option.label}
                        width="20"
                        height="15"
                        class="rounded-sm border border-surface-200 dark:border-surface-700"
                        loading="lazy"
                      />
                      <span>${option.label}</span>
                    </button>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
