import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-alert';
import './ui-button';
import { __ } from '../../services/i18n.service';

/**
 * Avviso quando manca un museo attivo selezionato.
 */
@customElement('ui-museum-required-notice')
export class UiMuseumRequiredNotice extends LitElement {
  @property({ type: String }) subject = 'risorse';
  @property({ type: String }) buttonLabel = '';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Azioni ──────────────────────────────────────────────
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
    const resolvedButtonLabel = this.buttonLabel || __('Seleziona museo');

    const translatedSubject =
      this.subject === 'contenuti'
        ? __('Contenuti')
        : this.subject === 'visite'
          ? __('Visite')
          : this.subject === 'opere'
            ? __('opere fisiche nei musei')
            : __(this.subject);

    return html`
      <ui-alert
        variant="warning"
        .title=${__('Museo non selezionato')}
        .message=${`${__('Seleziona un museo per lavorare su')} ${translatedSubject}.`}
      ></ui-alert>
      <div class="flex justify-end">
        <ui-button
          variant="secondary"
          size="sm"
          .label=${resolvedButtonLabel}
          @click=${this.handleSelectMuseum}
        ></ui-button>
      </div>
    `;
  }
}
