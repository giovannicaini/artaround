import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-image-placeholder';

/**
 * UI Data Grid
 *
 * Una griglia responsive coerente di card con immagini.
 * Usata comunemente per mostrare item, opere, visite, ecc.
 *
 * @example
 * ```html
 * <ui-data-grid
 *   .items=${this.items}
 *   .columns=${3}
 *   .renderItem=${(item) => html`<my-card .item=${item}></my-card>`}
 * ></ui-data-grid>
 * ```
 */
@customElement('ui-data-grid')
export class UiDataGrid extends LitElement {
  @property({ type: Array }) items: unknown[] = [];
  @property({ type: Number }) columns = 3;
  @property({ attribute: false }) renderItem: ((item: unknown, index: number) => unknown) | null =
    null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Helper ──────────────────────────────────────────────
  private getGridClasses() {
    const colClasses: Record<number, string> = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    };
    return colClasses[this.columns] || colClasses[3];
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    if (!this.renderItem) return nothing;

    return html`
      <div class="grid ${this.getGridClasses()} gap-6">
        ${this.items.map((item, index) => this.renderItem!(item, index))}
      </div>
    `;
  }
}
