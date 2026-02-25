import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-alert';
import './ui-button';

@customElement('ui-museum-required-notice')
export class UiMuseumRequiredNotice extends LitElement {
  @property({ type: String }) subject = 'risorse';
  @property({ type: String }) buttonLabel = 'Seleziona museo';

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Actions ──────────────────────────────────────────────
  private handleSelectMuseum() {
    this.dispatchEvent(
      new CustomEvent('select-museum', {
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <ui-alert
        variant="warning"
        title="Museo non selezionato"
        .message=${`Seleziona un museo per lavorare su ${this.subject}.`}
      ></ui-alert>
      <div class="flex justify-end">
        <ui-button
          variant="secondary"
          size="sm"
          .label=${this.buttonLabel}
          @click=${this.handleSelectMuseum}
        ></ui-button>
      </div>
    `;
  }
}
