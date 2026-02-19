import { LitElement, html } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import type { Museum, User } from '@artaround/shared';
import { getPermissions, type PermissionSet } from '../../services/permissions.service';
import '../museums/museum-selector';
import '../ui/ui-button';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-badge';
import '../ui/ui-icon';

@customElement('museums-page')
export class MuseumsPage extends LitElement {
  @property({ type: Object }) user: User | null = null;

  @state() private selectedMuseum: Museum | null = null;

  private get permissions(): PermissionSet {
    return getPermissions(this.user);
  }

  createRenderRoot() {
    return this;
  }

  private handleMuseumSelected(e: CustomEvent) {
    this.selectedMuseum = e.detail;
  }

  private handleConfirm() {
    if (this.selectedMuseum) {
      this.dispatchEvent(
        new CustomEvent('museum-confirmed', {
          detail: this.selectedMuseum,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private openMapEditor() {
    if (this.selectedMuseum) {
      this.dispatchEvent(
        new CustomEvent('open-map-editor', {
          detail: { museumId: this.selectedMuseum._id },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  render() {
    return html`
      <div class="space-y-6 animate-fade-in">
        <!-- Header -->
        <ui-page-header title="Seleziona Museo" description="Scegli il museo su cui vuoi lavorare">
          ${this.selectedMuseum
            ? html`
                <ui-button
                  slot="actions"
                  variant="primary"
                  size="md"
                  label="Conferma: ${this.selectedMuseum.name}"
                  icon="check"
                  @click=${this.handleConfirm}
                ></ui-button>
              `
            : ''}
        </ui-page-header>

        <!-- Selected Museum Banner -->
        ${this.selectedMuseum
          ? html`
              <ui-card padding="md">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-brand-600 flex items-center justify-center">
                      <ui-icon name="check" size="sm" class="text-white"></ui-icon>
                    </div>
                    <div>
                      <div class="flex items-center gap-2 mb-1">
                        <ui-badge variant="success" size="sm" label="Museo attivo"></ui-badge>
                        <p class="font-semibold text-surface-900 dark:text-white">
                          ${this.selectedMuseum.name}
                        </p>
                      </div>
                      <p class="text-sm text-surface-500 dark:text-surface-400">
                        ${this.selectedMuseum.location?.city || ''},
                        ${this.selectedMuseum.location?.country || ''}
                      </p>
                    </div>
                  </div>
                  <div class="flex gap-2">
                    ${this.permissions.canEditMuseum
                      ? html`
                          <ui-button
                            variant="secondary"
                            size="sm"
                            label="🗺️ Gestisci Mappe"
                            @click=${this.openMapEditor}
                          ></ui-button>
                        `
                      : ''}
                    <ui-button
                      variant="primary"
                      size="sm"
                      icon="check"
                      @click=${this.handleConfirm}
                    ></ui-button>
                  </div>
                </div>
              </ui-card>
            `
          : ''}

        <!-- Museum Grid -->
        <museum-selector @museum-selected=${this.handleMuseumSelected}></museum-selector>
      </div>
    `;
  }
}
