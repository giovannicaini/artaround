import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/auth.service';
import '../ui/ui-button';
import '../ui/ui-input';
import './auth-shell';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';

/**
 * Form di login: username e password, poi redirect alla dashboard.
 */
@customElement('login-page')
export class LoginPage extends LitElement {
  @state() private username = '';
  @state() private password = '';
  @state() private loading = false;
  @state() private error = '';

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  // ─── Azioni ──────────────────────────────────────────────
  private goToRegister() {
    this.dispatchEvent(new CustomEvent('go-to-register', { bubbles: true, composed: true }));
  }

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

  // ─── Render principale ────────────────────────────────────────
  render() {
    return html`
      <auth-shell
        .subtitle=${__('Accedi al pannello di amministrazione')}
        .renderContent=${() => html`
          <form @submit=${(e: Event) => this.handleSubmit(e)} class="space-y-5">
            ${renderFeedbackAlerts({ error: this.error })}

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

            <ui-button
              type="submit"
              variant="primary"
              size="lg"
              block
              ?loading=${this.loading}
              .label=${__('Accedi')}
            ></ui-button>

            <button
              type="button"
              class="w-full text-center text-sm text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              @click=${() => this.goToRegister()}
            >
              ${__('Non hai un account? Registrati')}
            </button>
          </form>
        `}
      ></auth-shell>
    `;
  }
}
