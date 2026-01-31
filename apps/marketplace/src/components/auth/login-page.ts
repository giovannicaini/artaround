import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/auth.service';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-card';

@customElement('login-page')
export class LoginPage extends LitElement {
  @state() private username = '';
  @state() private password = '';
  @state() private loading = false;
  @state() private error = '';

  createRenderRoot() { return this; }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    
    if (!this.username || !this.password) {
      this.error = 'Inserisci username e password';
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const user = await authService.login({ 
        username: this.username, 
        password: this.password 
      });

      if (user) {
        this.dispatchEvent(new CustomEvent('login-success', {
          detail: user,
          bubbles: true,
          composed: true
        }));
      } else {
        this.error = 'Username o password non validi';
      }
    } catch (err) {
      console.error('Login error:', err);
      this.error = 'Errore di connessione al server';
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      <div class="min-h-screen flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-950 p-4">
        <!-- Background Pattern -->
        <div class="absolute inset-0 overflow-hidden pointer-events-none">
          <div class="absolute -top-40 -right-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl"></div>
        </div>

        <div class="relative w-full max-w-sm animate-slide-up">
          <!-- Logo -->
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-600 mb-4">
              <span class="text-white font-bold text-xl">A</span>
            </div>
            <h1 class="text-2xl font-semibold text-surface-900 dark:text-white">
              ArtAround Admin
            </h1>
            <p class="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Accedi al pannello di amministrazione
            </p>
          </div>

          <!-- Login Card -->
          <ui-card padding="lg">
            <form @submit=${this.handleSubmit} class="space-y-5">
              ${this.error ? html`
                <div class="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800" role="alert">
                  <p class="text-sm text-danger-700 dark:text-danger-300 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    ${this.error}
                  </p>
                </div>
              ` : ''}

              <ui-input
                type="text"
                label="Username"
                placeholder="admin"
                .value=${this.username}
                required
                @input-change=${(e: CustomEvent) => this.username = e.detail.value}
              ></ui-input>

              <ui-input
                type="password"
                label="Password"
                placeholder="••••••••"
                .value=${this.password}
                required
                @input-change=${(e: CustomEvent) => this.password = e.detail.value}
              ></ui-input>

              <div class="flex items-center justify-between">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    class="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 dark:border-surface-600 dark:bg-surface-800"
                  />
                  <span class="text-sm text-surface-600 dark:text-surface-400">Ricordami</span>
                </label>
                <a href="#" class="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
                  Password dimenticata?
                </a>
              </div>

              <ui-button variant="primary" size="lg" block ?loading=${this.loading} label="Accedi"></ui-button>
            </form>
          </ui-card>

          <!-- Footer -->
          <p class="text-center text-xs text-surface-400 mt-6">
            &copy; 2026 ArtAround. Tutti i diritti riservati.
          </p>
        </div>
      </div>
    `;
  }
}
