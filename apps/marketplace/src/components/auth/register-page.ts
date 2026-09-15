/*
 * File: /src/components/auth/register-page.ts                                           *
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

/**
 * Registrazione di un nuovo utente.
 */
@customElement('register-page')
export class RegisterPage extends LitElement {
  @state() private username = '';
  @state() private email = '';
  @state() private password = '';
  @state() private confirmPassword = '';
  @state() private loading = false;
  @state() private error = '';

  createRenderRoot() {
    return this;
  }

  private goToLogin() {
    this.dispatchEvent(new CustomEvent('go-to-login', { bubbles: true, composed: true }));
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();

    if (!this.username || !this.email || !this.password) {
      this.error = __('Compila tutti i campi');
      return;
    }
    if (this.username.trim().length < 3) {
      this.error = __('Lo username deve avere almeno 3 caratteri');
      return;
    }
    if (this.password.length < 8) {
      this.error = __('La password deve avere almeno 8 caratteri');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error = __('Le password non coincidono');
      return;
    }

    this.loading = true;
    this.error = '';

    try {
      const { user, error } = await authService.register({
        username: this.username.trim(),
        email: this.email.trim(),
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
        this.error = error || __('Registrazione non riuscita');
      }
    } catch (err) {
      console.error('Register error:', err);
      this.error = __('Errore di connessione al server');
    } finally {
      this.loading = false;
    }
  }

  render() {
    return html`
      <auth-shell
        .subtitle=${__('Crea un nuovo account')}
        .renderContent=${() => html`
          <form @submit=${(e: Event) => this.handleSubmit(e)} class="space-y-5">
            ${renderFeedbackAlerts({ error: this.error })}

            <ui-input
              type="text"
              .label=${__('Username')}
              .placeholder=${__('mario_rossi')}
              .value=${this.username}
              required
              @input-change=${(e: CustomEvent) => (this.username = e.detail.value)}
            ></ui-input>

            <ui-input
              type="email"
              .label=${__('Email')}
              .placeholder=${__('mario@esempio.it')}
              .value=${this.email}
              required
              @input-change=${(e: CustomEvent) => (this.email = e.detail.value)}
            ></ui-input>

            <ui-input
              type="password"
              .label=${__('Password')}
              .placeholder=${__('••••••••')}
              .help=${__('Almeno 8 caratteri.')}
              .value=${this.password}
              required
              @input-change=${(e: CustomEvent) => (this.password = e.detail.value)}
            ></ui-input>

            <ui-input
              type="password"
              .label=${__('Conferma password')}
              .placeholder=${__('••••••••')}
              .value=${this.confirmPassword}
              required
              @input-change=${(e: CustomEvent) => (this.confirmPassword = e.detail.value)}
            ></ui-input>

            <ui-button
              type="submit"
              variant="primary"
              size="lg"
              block
              ?loading=${this.loading}
              .label=${__('Crea account')}
            ></ui-button>

            <button
              type="button"
              class="w-full text-center text-sm text-surface-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              @click=${() => this.goToLogin()}
            >
              ${__('Hai già un account? Accedi')}
            </button>
          </form>
        `}
      ></auth-shell>
    `;
  }
}
