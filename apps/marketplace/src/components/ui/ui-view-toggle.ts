import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-button';
import { __ } from '../../services/i18n.service';

export type ViewLayout = 'grid' | 'table';

/**
 * Interruttore Griglia/Tabella per le liste che offrono entrambe le viste.
 */
@customElement('ui-view-toggle')
export class UiViewToggle extends LitElement {
  @property({ type: String }) value: ViewLayout = 'grid';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private select(layout: ViewLayout) {
    this.dispatchEvent(
      new CustomEvent('layout-change', {
        detail: { value: layout },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <p class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
        ${__('Vista')}
      </p>
      <div class="flex items-center gap-2">
        <ui-button
          size="xs"
          .variant=${this.value === 'grid' ? 'primary' : 'secondary'}
          .label=${__('Griglia')}
          @click=${() => this.select('grid')}
        ></ui-button>
        <ui-button
          size="xs"
          .variant=${this.value === 'table' ? 'primary' : 'secondary'}
          .label=${__('Tabella')}
          @click=${() => this.select('table')}
        ></ui-button>
      </div>
    `;
  }
}
