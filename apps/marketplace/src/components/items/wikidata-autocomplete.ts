import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { wikidataService, type WikidataSearchResult } from '../../services/wikidata.service';
import '../ui/ui-input';
import '../ui/ui-icon';

@customElement('wikidata-autocomplete')
export class WikidataAutocomplete extends LitElement {
  @property({ type: String }) label = "Opera d'arte";
  @property({ type: String }) placeholder = 'Cerca su Wikidata...';
  @property({ type: String }) value = '';
  @property({ type: String }) selectedId = '';
  @property({ type: String }) error = '';
  @property({ type: Boolean }) required = false;
  @property({ type: Boolean }) disabled = false;

  @state() private query = '';
  @state() private results: WikidataSearchResult[] = [];
  @state() private loading = false;
  @state() private showDropdown = false;
  @state() private selectedLabel = '';

  private searchTimeout: number | null = null;

  createRenderRoot() {
    return this;
  }

  private handleInput(e: CustomEvent) {
    this.query = e.detail.value;
    this.selectedId = '';
    this.selectedLabel = '';

    // Debounce search
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (this.query.length >= 2) {
      this.searchTimeout = window.setTimeout(() => this.search(), 300);
    } else {
      this.results = [];
      this.showDropdown = false;
    }
  }

  private async search() {
    this.loading = true;
    this.showDropdown = true;

    try {
      this.results = await wikidataService.search(this.query);
    } catch (e) {
      console.error('Wikidata search error:', e);
      this.results = [];
    } finally {
      this.loading = false;
    }
  }

  private selectResult(result: WikidataSearchResult) {
    this.selectedId = result.id;
    this.selectedLabel = result.label;
    this.query = result.label;
    this.showDropdown = false;
    this.results = [];

    this.dispatchEvent(
      new CustomEvent('wikidata-select', {
        detail: {
          id: result.id,
          label: result.label,
          description: result.description,
          imageUrl: result.imageUrl,
          author: result.author,
          authorId: result.authorId,
          style: result.style,
          styleId: result.styleId,
          epoch: result.epoch,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleFocus() {
    if (this.results.length > 0) {
      this.showDropdown = true;
    }
  }

  private handleBlur() {
    // Delay hiding to allow click on results
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  render() {
    return html`
      <div class="relative">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
          ${this.label} ${this.required ? html`<span class="text-danger-500 ml-0.5">*</span>` : ''}
        </label>

        <div class="relative">
          <input
            type="text"
            class="block w-full pl-10 pr-10 py-2.5 text-sm rounded-lg border transition-colors duration-150
              bg-white dark:bg-surface-900
              text-surface-900 dark:text-white
              placeholder:text-surface-400 dark:placeholder:text-surface-500
              focus:outline-none focus:ring-2 focus:ring-offset-0
              ${this.error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
              : 'border-surface-300 dark:border-surface-600 focus:border-brand-500 focus:ring-brand-500/20'}"
            placeholder="${this.placeholder}"
            .value="${this.query || this.selectedLabel}"
            ?disabled="${this.disabled}"
            @input="${(e: Event) =>
              this.handleInput(
                new CustomEvent('input-change', {
                  detail: { value: (e.target as HTMLInputElement).value },
                }),
              )}"
            @focus="${this.handleFocus}"
            @blur="${this.handleBlur}"
          />

          <!-- Search icon -->
          <div class="absolute inset-y-0 left-0 flex items-center pl-3">
            <ui-icon name="search" size="xs" class="text-surface-400"></ui-icon>
          </div>

          <!-- Status icon -->
          <div class="absolute inset-y-0 right-0 flex items-center pr-3">
            ${this.loading
              ? html`
                  <svg
                    class="animate-spin h-4 w-4 text-surface-400"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                `
              : this.selectedId
                ? html` <ui-icon name="check" size="xs" class="text-success-500"></ui-icon> `
                : ''}
          </div>
        </div>

        <!-- Selected ID badge -->
        ${this.selectedId
          ? html`
              <div class="mt-1.5 flex items-center gap-2">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300"
                >
                  <ui-icon name="link" size="xs" class="mr-1"></ui-icon>
                  ${this.selectedId}
                </span>
              </div>
            `
          : ''}

        <!-- Dropdown results -->
        ${this.showDropdown && (this.results.length > 0 || this.loading)
          ? html`
              <div
                class="absolute z-50 w-full mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                ${this.loading && this.results.length === 0
                  ? html`
                      <div
                        class="px-4 py-3 text-sm text-surface-500 dark:text-surface-400 flex items-center gap-2"
                      >
                        <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle
                            class="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            stroke-width="4"
                          ></circle>
                          <path
                            class="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          ></path>
                        </svg>
                        Ricerca in corso...
                      </div>
                    `
                  : this.results.length === 0
                    ? html`
                        <div class="px-4 py-3 text-sm text-surface-500 dark:text-surface-400">
                          Nessun risultato trovato
                        </div>
                      `
                    : this.results.map(
                        (result) => html`
                          <button
                            type="button"
                            class="w-full px-4 py-3 text-left hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors border-b border-surface-100 dark:border-surface-700 last:border-0"
                            @click="${() => this.selectResult(result)}"
                          >
                            <div class="flex items-start gap-3">
                              <!-- Thumbnail image -->
                              ${result.imageUrl
                                ? html`
                                    <div
                                      class="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-surface-100 dark:bg-surface-700"
                                    >
                                      <img
                                        src="${result.imageUrl}"
                                        alt="${result.label}"
                                        class="w-full h-full object-cover"
                                        loading="lazy"
                                        @error="${(e: Event) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                        }}"
                                      />
                                    </div>
                                  `
                                : html`
                                    <div
                                      class="flex-shrink-0 w-12 h-12 rounded bg-surface-100 dark:bg-surface-700 flex items-center justify-center"
                                    >
                                      <ui-icon
                                        name="image"
                                        size="sm"
                                        class="text-surface-400"
                                      ></ui-icon>
                                    </div>
                                  `}
                              <div class="flex-1 min-w-0">
                                <p
                                  class="text-sm font-medium text-surface-900 dark:text-white truncate"
                                >
                                  ${result.label}
                                </p>
                                ${result.description
                                  ? html`
                                      <p
                                        class="text-xs text-surface-500 dark:text-surface-400 line-clamp-1"
                                      >
                                        ${result.description}
                                      </p>
                                    `
                                  : ''}
                                <!-- Metadata row: author, style, epoch -->
                                <div class="flex flex-wrap items-center gap-2 mt-1">
                                  ${result.author
                                    ? html`
                                        <span
                                          class="inline-flex items-center text-xs text-surface-600 dark:text-surface-300"
                                        >
                                          <ui-icon
                                            name="user"
                                            size="xs"
                                            class="mr-0.5 text-surface-400"
                                          ></ui-icon>
                                          ${result.author}
                                        </span>
                                      `
                                    : ''}
                                  ${result.style
                                    ? html`
                                        <span
                                          class="inline-flex items-center text-xs text-surface-600 dark:text-surface-300"
                                        >
                                          <ui-icon
                                            name="palette"
                                            size="xs"
                                            class="mr-0.5 text-surface-400"
                                          ></ui-icon>
                                          ${result.style}
                                        </span>
                                      `
                                    : ''}
                                  ${result.epoch
                                    ? html`
                                        <span
                                          class="inline-flex items-center text-xs text-surface-600 dark:text-surface-300"
                                        >
                                          <ui-icon
                                            name="calendar"
                                            size="xs"
                                            class="mr-0.5 text-surface-400"
                                          ></ui-icon>
                                          ${result.epoch}
                                        </span>
                                      `
                                    : ''}
                                </div>
                                <p class="text-xs text-brand-600 dark:text-brand-400 mt-0.5">
                                  ${result.id}
                                </p>
                              </div>
                            </div>
                          </button>
                        `,
                      )}
              </div>
            `
          : ''}
        ${this.error
          ? html`
              <p
                class="mt-1.5 text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1"
                role="alert"
              >
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clip-rule="evenodd"
                  />
                </svg>
                ${this.error}
              </p>
            `
          : ''}
      </div>
    `;
  }
}
