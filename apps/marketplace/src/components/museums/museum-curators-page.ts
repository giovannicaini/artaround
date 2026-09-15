/*
 * File: /src/components/museums/museum-curators-page.ts                                 *
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
import { customElement, property, state } from 'lit/decorators.js';
import type { Museum, MuseumCurator, User } from '@artaround/shared';
import { museumService } from '../../services/museum.service';
import { userService } from '../../services/user.service';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-avatar';
import '../ui/ui-section';
import '../ui/ui-select';
import '../ui/ui-button';
import '../ui/ui-loading';
import '../ui/ui-alert';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';

/**
 * Assegnazione/revoca curatori di un museo
 */
@customElement('museum-curators-page')
export class MuseumCuratorsPage extends LitElement {
  @property({ type: Object }) museum: Museum | null = null;

  @state() private curators: MuseumCurator[] = [];
  @state() private loadingCurators = false;
  @state() private availableUsers: User[] = [];
  @state() private loadingUsers = false;
  @state() private selectedUserId = '';
  @state() private addingCurator = false;
  @state() private removingCuratorId: string | null = null;
  @state() private error = '';
  @state() private success = '';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadAll();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('museum') && this.museum) void this.loadAll();
  }

  private async loadAll() {
    await this.loadCurators();
    await this.loadAvailableUsers();
  }

  private async loadCurators() {
    if (!this.museum) return;
    this.loadingCurators = true;
    try {
      this.curators = await museumService.getCurators(this.museum._id);
    } catch (e) {
      console.error('Error loading curators:', e);
      this.error = __('Errore nel caricamento dei curatori');
    } finally {
      this.loadingCurators = false;
    }
  }

  private async loadAvailableUsers() {
    this.loadingUsers = true;
    try {
      const response = await userService.getUsers({ limit: 100, isActive: true });
      // Esclude gli utenti già curatori
      const curatorIds = new Set(this.curators.map((c) => c._id));
      this.availableUsers = response.users.filter((u) => !curatorIds.has(u._id));
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      this.loadingUsers = false;
    }
  }

  private async handleAddCurator() {
    if (!this.selectedUserId || !this.museum) return;
    this.addingCurator = true;
    this.error = '';
    try {
      const result = await museumService.addCurator(this.museum._id, this.selectedUserId);
      if (result.success) {
        this.success = __('Curatore aggiunto con successo');
        this.selectedUserId = '';
        await this.loadAll();
      } else {
        this.error = result.error || "Errore durante l'aggiunta del curatore";
      }
    } catch {
      this.error = __("Errore durante l'aggiunta del curatore");
    } finally {
      this.addingCurator = false;
    }
  }

  private async handleRemoveCurator(userId: string) {
    if (!this.museum) return;
    this.removingCuratorId = userId;
    this.error = '';
    try {
      const result = await museumService.removeCurator(this.museum._id, userId);
      if (result.success) {
        this.success = __('Curatore rimosso con successo');
        await this.loadAll();
      } else {
        this.error = result.error || 'Errore durante la rimozione del curatore';
      }
    } catch {
      this.error = __('Errore durante la rimozione del curatore');
    } finally {
      this.removingCuratorId = null;
    }
  }

  private back() {
    this.dispatchEvent(new CustomEvent('back', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <ui-page-header
        title="${__('Curatori')} - ${this.museum?.name}"
        .description=${__('Gestisci i curatori che possono modificare questo museo')}
        .help=${__(
          'Solo il ruolo Curatore si assegna da qui. Per assegnare il ruolo Autore (che può creare item/visite ma non gestire il museo) usa la pagina Utenti.',
        )}
        showBack
        @back=${() => this.back()}
      ></ui-page-header>

      ${renderFeedbackAlerts({ error: this.error, success: this.success })}

      <ui-card padding="none">
        <div class="p-6 space-y-6">
          <ui-section
            .title=${__('Aggiungi Curatore')}
            .description=${__('Assegna un nuovo curatore a questo museo')}
            .renderContent=${() => html`
              <div class="flex gap-3 items-end">
                <div class="flex-1">
                  <ui-select
                    .label=${__('Seleziona utente')}
                    placeholder=${this.loadingUsers ? __('Caricamento...') : __('Scegli un utente')}
                    .value=${this.selectedUserId}
                    .options=${this.availableUsers.map((u) => ({
                      value: u._id,
                      label: `${u.username} (${u.email})`,
                    }))}
                    @select-change=${(e: CustomEvent) => (this.selectedUserId = e.detail.value)}
                    ?disabled=${this.loadingUsers}
                  ></ui-select>
                </div>
                <ui-button
                  variant="primary"
                  .label=${__('Aggiungi')}
                  icon="plus"
                  .loading=${this.addingCurator}
                  ?disabled=${!this.selectedUserId}
                  @click=${() => this.handleAddCurator()}
                ></ui-button>
              </div>
            `}
          ></ui-section>

          <ui-section
            .title=${__('Curatori Attuali')}
            .description=${__('Utenti con permesso di modifica')}
            .renderContent=${() =>
              this.loadingCurators
                ? html`<ui-loading></ui-loading>`
                : this.curators.length === 0
                  ? html`<p class="text-surface-500 text-sm">${__('Nessun curatore assegnato')}</p>`
                  : html`
                      <div class="space-y-3">
                        ${this.curators.map(
                          (curator) => html`
                            <div
                              class="flex items-center justify-between p-3 rounded-lg bg-surface-50 dark:bg-surface-800"
                            >
                              <div class="flex items-center gap-3">
                                <ui-avatar
                                  size="md"
                                  .initials=${curator.username.charAt(0).toUpperCase()}
                                ></ui-avatar>
                                <div>
                                  <p class="font-medium text-surface-900 dark:text-white">
                                    ${curator.username}
                                  </p>
                                  <p class="text-sm text-surface-500">${curator.email}</p>
                                </div>
                              </div>
                              <ui-button
                                variant="secondary"
                                size="sm"
                                .label=${__('Rimuovi')}
                                icon="trash"
                                .loading=${this.removingCuratorId === curator._id}
                                @click=${() => this.handleRemoveCurator(curator._id)}
                              ></ui-button>
                            </div>
                          `,
                        )}
                      </div>
                    `}
          ></ui-section>
        </div>
      </ui-card>
    `;
  }
}
