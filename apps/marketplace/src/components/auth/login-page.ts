/*
 * File: /src/components/auth/login-page.ts                                              *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../../services/auth.service';
import '../ui/ui-button';
import '../ui/ui-input';
import './auth-shell';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';

// Utenti previsti dal progetto + altri ruoli aggiunti, tutti con stessa pw
const TEST_USERS_PASSWORD = '12345678';
const TEST_USER_GROUPS: { role: string; usernames: string[] }[] = [
  { role: __('Admin'), usernames: ['admin'] },
  { role: __('Curatore'), usernames: ['curatore1', 'curatore2'] },
  { role: __('Autore'), usernames: ['autore1', 'autore2'] },
  { role: __('Visitatore'), usernames: ['visitatore1', 'visitatore2'] },
];

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

  private fillTestUser(username: string) {
    this.username = username;
    this.password = TEST_USERS_PASSWORD;
    this.error = '';
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

  // ─── Helper di render ──────────────────────────────────────
  private renderTestUsersPanel() {
    return html`
      <div class="pl-4 border-l border-surface-200 dark:border-surface-800">
        <p
          class="text-[11px] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-600 mb-2"
        >
          ${__('Utenti di test')}
        </p>
        <div class="space-y-2.5">
          ${TEST_USER_GROUPS.map(
            (group) => html`
              <div class="flex items-baseline gap-2">
                <span class="text-[11px] text-surface-400 dark:text-surface-600 w-14 shrink-0"
                  >${group.role}</span
                >
                <div class="flex flex-wrap gap-1">
                  ${group.usernames.map(
                    (username) => html`
                      <button
                        type="button"
                        class="focus-glow text-[11px] text-surface-400 dark:text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 underline decoration-dotted underline-offset-2 transition-colors"
                        @click=${() => this.fillTestUser(username)}
                      >
                        ${username}
                      </button>
                    `,
                  )}
                </div>
              </div>
            `,
          )}
        </div>
        <p class="text-[11px] text-surface-300 dark:text-surface-700 mt-2">
          ${__('Password')}: ${TEST_USERS_PASSWORD}
        </p>
      </div>
    `;
  }

  // ─── Render principale ────────────────────────────────────────
  render() {
    return html`
      <auth-shell
        .renderSidePanel=${() => this.renderTestUsersPanel()}
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
