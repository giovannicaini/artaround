import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/auth.service';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-card';
import '../ui/ui-alert';
import '../ui/ui-checkbox';
import '../ui/ui-brand-mark';
import { __ } from '../../services/i18n.service';

@customElement('login-page')
export class LoginPage extends LitElement {
  @state() private username = '';
  @state() private password = '';
  @state() private loading = false;
  @state() private error = '';

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Actions ──────────────────────────────────────────────
  private async handleSubmit(e: Event) {
    e.preventDefault();

    if (!this.username || !this.password) {
      this.error = __('Inserisci username e password');
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const user = await authService.login({
        username: this.username,
        password: this.password,
      });

      if (user) {
        this.dispatchEvent(
          new CustomEvent('login-success', {
            detail: user,
            bubbles: true,
            composed: true,
          }),
        );
      } else {
        this.error = __('Username o password non validi');
      }
    } catch (err) {
      console.error('Login error:', err);
      this.error = __('Errore di connessione al server');
    } finally {
      this.loading = false;
    }
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    return html`
      <div
        class="min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-950 p-4"
      >
        <!-- Background Pattern -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            class="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"
          ></div>
          <div
            class="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"
          ></div>
        </div>

        <div class="relative w-full max-w-sm animate-slide-up">
          <!-- Logo -->
          <div class="text-center mb-8">
            <div class="inline-flex mb-4">
              <ui-brand-mark
                iconSizeClass="w-12 h-12"
                text="ArtAround Admin"
                textClass="text-2xl font-semibold text-surface-900 dark:text-white"
              ></ui-brand-mark>
            </div>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              ${__('Accedi al pannello di amministrazione')}
            </p>
          </div>

          <!-- Login Card -->
          <ui-card padding="lg">
            <form @submit=${this.handleSubmit} class="space-y-5">
              ${this.error
                ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>`
                : nothing}

              <ui-input
                type="text"
                .label=${__('Username')}
                .placeholder=${__('admin')}
                .value=${this.username}
                required
                @input-change=${(e: CustomEvent) => (this.username = e.detail.value)}
              ></ui-input>

              <ui-input
                type="password"
                .label=${__('Password')}
                .placeholder=${__('••••••••')}
                .value=${this.password}
                required
                @input-change=${(e: CustomEvent) => (this.password = e.detail.value)}
              ></ui-input>

              <div class="flex items-center justify-between">
                <ui-checkbox .label=${__('Ricordami')}></ui-checkbox>
                <a
                  href="#"
                  class="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  ${__('Password dimenticata?')}
                </a>
              </div>

              <ui-button
                type="submit"
                variant="primary"
                size="lg"
                block
                ?loading=${this.loading}
                .label=${__('Accedi')}
              ></ui-button>
            </form>
          </ui-card>

          <!-- Footer -->
          <p class="text-center text-xs text-surface-400 mt-6">
            ${__('© 2026 ArtAround. Tutti i diritti riservati.')}
          </p>
        </div>
      </div>
    `;
  }
}
