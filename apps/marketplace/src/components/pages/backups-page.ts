/*
 * File: /src/components/pages/backups-page.ts                                           *
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

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Backup } from '@artaround/shared';
import { backupService } from '../../services/backup.service';
import { modalService } from '../../services/modal.service';
import { __ } from '../../services/i18n.service';
import '../ui/ui-button';
import '../ui/ui-card';
import '../ui/ui-icon';
import '../ui/ui-badge';
import '../ui/ui-loading';
import '../ui/ui-alert';
import '../ui/ui-page-header';
import '../ui/ui-input';
import { renderInlineEmptyState } from '../../utils/inline-empty-state';

const POLL_INTERVAL_MS = 4000;

/**
 * Snapshot di database + cartella uploads: creazione e ripristino (solo
 * admin, dal menu utente) — permette di "provare" liberamente e poi
 * riportare tutto allo stato dello snapshot scelto.
 */
@customElement('backups-page')
export class BackupsPage extends LitElement {
  @state() private backups: Backup[] = [];
  @state() private loading = true;
  @state() private creating = false;
  @state() private newLabel = '';
  @state() private error = '';
  @state() private success = '';
  @state() private confirmingRestoreId: string | null = null;
  @state() private restoreConfirmText = '';
  @state() private restoringId: string | null = null;
  @state() private deletingId: string | null = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
    void this.load();
  }

  disconnectedCallback() {
    this.stopPolling();
    super.disconnectedCallback();
  }

  private async load(): Promise<void> {
    this.backups = await backupService.list();
    this.loading = false;
    this.reschedulePolling();
  }

  private reschedulePolling(): void {
    const hasActive = this.backups.some((b) => b.status === 'creating' || b.status === 'restoring');
    if (hasActive && !this.pollTimer) {
      this.pollTimer = setInterval(() => void this.load(), POLL_INTERVAL_MS);
    } else if (!hasActive) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async handleCreate(): Promise<void> {
    this.creating = true;
    this.error = '';
    this.success = '';
    const result = await backupService.create(this.newLabel);
    this.creating = false;
    if (result.success) {
      this.newLabel = '';
      this.success = __('Creazione dello snapshot avviata.');
      await this.load();
    } else {
      this.error = result.error || __('Errore durante la creazione del backup');
    }
  }

  private openRestoreConfirm(id: string): void {
    this.confirmingRestoreId = id;
    this.restoreConfirmText = '';
  }

  private closeRestoreConfirm(): void {
    this.confirmingRestoreId = null;
    this.restoreConfirmText = '';
  }

  private async handleRestore(id: string): Promise<void> {
    this.restoringId = id;
    this.error = '';
    this.success = '';
    const result = await backupService.restore(id);
    this.restoringId = null;
    this.closeRestoreConfirm();
    if (result.success) {
      this.success = __(
        'Ripristino avviato: database e file torneranno come nello snapshot a breve.',
      );
      await this.load();
    } else {
      this.error = result.error || __('Errore durante il ripristino');
    }
  }

  private async handleDelete(backup: Backup): Promise<void> {
    const confirmed = await modalService.confirm({
      title: __('Eliminare questo snapshot?'),
      message: __('"{label}" verrà eliminato definitivamente.').replace('{label}', backup.label),
      variant: 'danger',
      confirmLabel: __('Elimina'),
      cancelLabel: __('Annulla'),
    });
    if (!confirmed) return;

    this.deletingId = backup.id;
    const result = await backupService.remove(backup.id);
    this.deletingId = null;
    if (result.success) {
      await this.load();
    } else {
      this.error = result.error || __("Errore durante l'eliminazione");
    }
  }

  private formatBytes(bytes?: number): string {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private formatDate(iso: string): string {
    return new Date(iso).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private statusBadge(backup: Backup) {
    switch (backup.status) {
      case 'creating':
        return html`<ui-badge variant="primary" .label=${__('Creazione in corso')}></ui-badge>`;
      case 'restoring':
        return html`<ui-badge variant="warning" .label=${__('Ripristino in corso')}></ui-badge>`;
      case 'failed':
        return html`<ui-badge variant="danger" icon="x" .label=${__('Fallito')}></ui-badge>`;
      case 'ready':
        return html`<ui-badge variant="success" icon="check" .label=${__('Pronto')}></ui-badge>`;
    }
  }

  private progressLabel(backup: Backup): string {
    if (!backup.progress) return '';
    if (backup.progress.phase === 'db') {
      return __('Database: {done}/{total} collezioni')
        .replace('{done}', String(backup.progress.collectionsDone))
        .replace('{total}', String(backup.progress.collectionsTotal));
    }
    if (backup.progress.phase === 'uploads') {
      return __('Archiviazione dei file caricati…');
    }
    return '';
  }

  private renderBackupRow(backup: Backup) {
    const busy = backup.status === 'creating' || backup.status === 'restoring';

    return html`
      <ui-card padding="sm">
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p class="font-semibold text-surface-900 dark:text-white">${backup.label}</p>
              <p class="text-xs text-surface-500 dark:text-surface-400 mt-0.5">
                ${this.formatDate(backup.createdAt)} — ${backup.createdByName || backup.createdBy}
              </p>
            </div>
            ${this.statusBadge(backup)}
          </div>

          ${busy
            ? html`<p class="text-xs text-surface-500 dark:text-surface-400">
                ${this.progressLabel(backup)}
              </p>`
            : nothing}
          ${backup.status === 'ready'
            ? html`
                <div class="flex items-center gap-4 text-xs text-surface-500 dark:text-surface-400">
                  <span>${this.formatBytes(backup.sizeBytes)}</span>
                  <span
                    >${__('{count} collezioni').replace(
                      '{count}',
                      String(backup.collectionsCount ?? 0),
                    )}</span
                  >
                  <span
                    >${__('{count} documenti').replace(
                      '{count}',
                      String(backup.documentsCount ?? 0),
                    )}</span
                  >
                  ${backup.restoredAt
                    ? html`<span
                        >${__('Ripristinato il {date}').replace(
                          '{date}',
                          this.formatDate(backup.restoredAt),
                        )}</span
                      >`
                    : nothing}
                </div>
              `
            : nothing}
          ${backup.error
            ? html`<p class="text-xs text-danger-600 dark:text-danger-400">${backup.error}</p>`
            : nothing}
          ${this.confirmingRestoreId === backup.id
            ? html`
                <div
                  class="rounded-lg border border-danger-300 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/20 p-3 space-y-2"
                >
                  <p class="text-sm text-danger-700 dark:text-danger-400 font-medium">
                    ${__(
                      'Questo sovrascriverà TUTTI i dati attuali (database e file caricati) con quelli dello snapshot. Non è reversibile se non hai un altro snapshot più recente.',
                    )}
                  </p>
                  <p class="text-xs text-danger-600 dark:text-danger-400">
                    ${__('Scrivi "{word}" per confermare.').replace('{word}', __('RIPRISTINA'))}
                  </p>
                  <ui-input
                    .value=${this.restoreConfirmText}
                    @input-change=${(e: CustomEvent<{ value: string }>) =>
                      (this.restoreConfirmText = e.detail.value)}
                  ></ui-input>
                  <div class="flex items-center gap-2">
                    <ui-button
                      variant="danger"
                      size="sm"
                      .label=${this.restoringId === backup.id
                        ? __('Ripristino…')
                        : __('Conferma ripristino')}
                      ?disabled=${this.restoreConfirmText !== __('RIPRISTINA') ||
                      this.restoringId === backup.id}
                      @click=${() => this.handleRestore(backup.id)}
                    ></ui-button>
                    <ui-button
                      variant="secondary"
                      size="sm"
                      .label=${__('Annulla')}
                      @click=${() => this.closeRestoreConfirm()}
                    ></ui-button>
                  </div>
                </div>
              `
            : html`
                <div class="flex items-center gap-2">
                  <ui-button
                    variant="secondary"
                    size="sm"
                    icon="clock"
                    .label=${__('Ripristina')}
                    ?disabled=${backup.status !== 'ready'}
                    @click=${() => this.openRestoreConfirm(backup.id)}
                  ></ui-button>
                  <ui-button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    .label=${this.deletingId === backup.id ? __('Eliminazione…') : __('Elimina')}
                    ?disabled=${busy || this.deletingId === backup.id}
                    @click=${() => this.handleDelete(backup)}
                  ></ui-button>
                </div>
              `}
        </div>
      </ui-card>
    `;
  }

  render() {
    return html`
      <div class="space-y-6">
        <ui-page-header
          .title=${__('Backup')}
          .description=${__(
            "Crea uno snapshot di database e file caricati, e ripristinalo quando serve per riportare tutto com'era.",
          )}
        ></ui-page-header>

        ${this.error
          ? html`<ui-alert variant="danger" .message=${this.error}></ui-alert>`
          : nothing}
        ${this.success
          ? html`<ui-alert variant="success" .message=${this.success}></ui-alert>`
          : nothing}

        <ui-card padding="sm">
          <div class="flex items-end gap-2 flex-wrap">
            <div class="flex-1 min-w-[12rem]">
              <ui-input
                .label=${__('Etichetta (facoltativa)')}
                .value=${this.newLabel}
                .placeholder=${__('Es. prima della modifica X')}
                @input-change=${(e: CustomEvent<{ value: string }>) =>
                  (this.newLabel = e.detail.value)}
              ></ui-input>
            </div>
            <ui-button
              variant="primary"
              icon="save"
              .label=${this.creating ? __('Creazione…') : __('Crea snapshot')}
              ?disabled=${this.creating}
              @click=${() => this.handleCreate()}
            ></ui-button>
          </div>
        </ui-card>

        ${this.loading
          ? html`<ui-loading .text=${__('Caricamento backup...')}></ui-loading>`
          : this.backups.length === 0
            ? renderInlineEmptyState({
                icon: 'folder',
                text: __('Nessuno snapshot ancora: creane uno con il modulo qui sopra.'),
              })
            : html`<div class="space-y-3">
                ${this.backups.map((b) => this.renderBackupRow(b))}
              </div>`}
      </div>
    `;
  }
}
