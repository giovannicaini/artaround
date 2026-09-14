import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-button';
import { __ } from '../../services/i18n.service';

/**
 * Coppia di bottoni Annulla/Salva a fondo form.
 */
@customElement('ui-form-actions')
export class UiFormActions extends LitElement {
  @property({ type: String }) submitLabel = '';
  @property({ type: String }) cancelLabel = '';
  @property({ type: String }) submitIcon = 'save';
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) hideCancel = false;
  @property({ type: String }) submitVariant: 'primary' | 'danger' = 'primary';
  @property({ type: String }) cancelVariant: 'secondary' | 'ghost' = 'secondary';
  @property({ type: String }) align: 'left' | 'center' | 'right' | 'between' = 'right';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleCancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
  }

  private handleSubmit() {
    this.dispatchEvent(new CustomEvent('submit', { bubbles: true, composed: true }));
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const resolvedSubmitLabel = this.submitLabel || __('Salva');
    const resolvedCancelLabel = this.cancelLabel || __('Annulla');

    const alignClasses = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return html`
      <div
        class="flex items-center gap-3 pt-6 border-t border-surface-200 dark:border-surface-700 ${alignClasses[
          this.align
        ]}"
      >
        ${!this.hideCancel
          ? html`
              <ui-button
                type="button"
                variant=${this.cancelVariant}
                .label=${resolvedCancelLabel}
                @click=${this.handleCancel}
                ?disabled=${this.loading}
              ></ui-button>
            `
          : nothing}
        <ui-button
          type="submit"
          variant=${this.submitVariant}
          .label=${resolvedSubmitLabel}
          icon=${this.submitIcon}
          .loading=${this.loading}
          ?disabled=${this.disabled}
          @click=${this.handleSubmit}
        ></ui-button>
      </div>
    `;
  }
}
