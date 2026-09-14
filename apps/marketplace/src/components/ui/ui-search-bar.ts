import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import './ui-input';
import './ui-button';

/**
 * Barra di ricerca testuale con icona e pulsante di reset.
 */
@customElement('ui-search-bar')
export class UiSearchBar extends LitElement {
  @property({ type: String }) value = '';
  @property({ type: String }) placeholder = 'Cerca...';
  @property({ type: Boolean }) showButton = true;
  @property({ type: Boolean }) debounce = false;
  @property({ type: Number }) debounceMs = 300;

  @state() private internalValue = '';
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    this.internalValue = this.value;
  }

  updated(changedProps: Map<string, unknown>) {
    if (changedProps.has('value') && this.value !== this.internalValue) {
      this.internalValue = this.value;
    }
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleInput(e: CustomEvent) {
    this.internalValue = e.detail.value;

    this.dispatchEvent(
      new CustomEvent('input-change', {
        detail: { value: this.internalValue },
        bubbles: true,
        composed: true,
      }),
    );

    if (this.debounce) {
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.emitSearch();
      }, this.debounceMs);
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
      this.emitSearch();
    }
  }

  private handleButtonClick() {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.emitSearch();
  }

  private emitSearch() {
    this.dispatchEvent(
      new CustomEvent('search', {
        detail: { value: this.internalValue },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="flex gap-2">
        <ui-input
          type="search"
          placeholder=${this.placeholder}
          .value=${this.internalValue}
          @input-change=${this.handleInput}
          @keydown=${this.handleKeydown}
        ></ui-input>
        ${this.showButton
          ? html`
              <ui-button
                variant="secondary"
                icon="search"
                @click=${this.handleButtonClick}
              ></ui-button>
            `
          : nothing}
      </div>
    `;
  }
}
