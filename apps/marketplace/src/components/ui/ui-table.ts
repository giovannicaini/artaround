/*
 * File: /src/components/ui/ui-table.ts                                                  *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 02/09/2026                                                             *
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
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import './ui-button';

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (value: unknown, row: Record<string, unknown>) => unknown;
}

export interface TableAction {
  icon: string;
  label: string;
  variant?: 'ghost' | 'danger';
  action: string;
  condition?: (row: Record<string, unknown>) => boolean;
}

/**
 * Tabella con colonne configurabili e azioni per riga.
 */
@customElement('ui-table')
export class UiTable extends LitElement {
  @property({ type: Array }) columns: TableColumn[] = [];
  @property({ type: Array }) data: Record<string, unknown>[] = [];
  @property({ type: Array }) actions: TableAction[] = [];
  @property({ type: Boolean }) clickable = false;
  @property({ type: Boolean }) striped = false;
  @property({ type: Boolean }) compact = false;
  @property({ type: String }) selectedRowId = '';
  @property({ type: String }) rowKeyField = '_id';
  @property({ type: String }) sortKey = '';
  @property({ type: String }) sortDir: 'asc' | 'desc' = 'asc';
  @property({ type: Boolean }) externalSort = false;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  // ─── Azioni ──────────────────────────────────────────────
  private handleSort(column: TableColumn) {
    if (!column.sortable) return;

    const nextSortKey = column.key;
    const nextSortDir =
      this.sortKey === column.key && this.sortDir === 'asc' ? 'desc' : ('asc' as const);

    if (this.externalSort) {
      this.dispatchEvent(
        new CustomEvent('sort-change', {
          detail: { key: nextSortKey, direction: nextSortDir },
          bubbles: true,
          composed: true,
        }),
      );
      return;
    }

    this.sortKey = nextSortKey;
    this.sortDir = nextSortDir;

    this.dispatchEvent(
      new CustomEvent('sort-change', {
        detail: { key: nextSortKey, direction: nextSortDir },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleRowClick(row: Record<string, unknown>) {
    if (!this.clickable) return;
    this.dispatchEvent(
      new CustomEvent('row-click', {
        detail: { row },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleAction(action: string, row: Record<string, unknown>, e: Event) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('row-action', {
        detail: { action, row },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // ─── Helper ──────────────────────────────────────────────
  private get sortedData() {
    if (this.externalSort) return this.data;
    if (!this.sortKey) return this.data;

    return [...this.data].sort((a, b) => {
      const aVal = String(a[this.sortKey] || '');
      const bVal = String(b[this.sortKey] || '');
      const cmp = aVal.localeCompare(bVal);
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
  }

  private getCellValue(row: Record<string, unknown>, column: TableColumn) {
    if (column.render) {
      return column.render(row[column.key], row);
    }
    return row[column.key];
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    const cellPadding = this.compact ? 'px-4 py-2' : 'px-6 py-4';
    const headerPadding = this.compact ? 'px-4 py-2' : 'px-6 py-3';

    return html`
      <div class="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
        <table class="w-full">
          <thead class="bg-surface-50 dark:bg-surface-800/50">
            <tr>
              ${this.columns.map((col) => {
                const alignClass =
                  col.align === 'center'
                    ? 'text-center'
                    : col.align === 'right'
                      ? 'text-right'
                      : 'text-left';
                return html`
                  <th
                    class="${headerPadding} ${alignClass} text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider ${col.sortable
                      ? 'cursor-pointer hover:text-surface-700 dark:hover:text-surface-200'
                      : ''}"
                    style="${col.width ? `width: ${col.width}` : ''}"
                    @click=${() => this.handleSort(col)}
                  >
                    <span class="inline-flex items-center gap-1">
                      ${col.label}
                      ${col.sortable && this.sortKey === col.key
                        ? html`
                            <ui-icon
                              name="${this.sortDir === 'asc' ? 'chevron-up' : 'chevron-down'}"
                              size="xs"
                            ></ui-icon>
                          `
                        : nothing}
                    </span>
                  </th>
                `;
              })}
              ${this.actions.length > 0
                ? html`
                    <th
                      class="${headerPadding} text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider"
                    >
                      Azioni
                    </th>
                  `
                : nothing}
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-200 dark:divide-surface-700">
            ${this.sortedData.map((row, index) => {
              const rowId = row[this.rowKeyField] as string;
              const isSelected = this.selectedRowId && rowId === this.selectedRowId;

              // Costruisce le classi della riga
              let rowClasses = 'transition-colors border-l-4 ';

              if (isSelected) {
                // Riga selezionata - evidenziazione forte
                rowClasses += 'bg-brand-100 dark:bg-brand-900/40 border-l-brand-500 ';
              } else {
                // Righe non selezionate
                rowClasses += 'border-l-transparent ';
                if (this.striped && index % 2 === 1) {
                  rowClasses += 'bg-surface-50/50 dark:bg-surface-800/25 ';
                } else {
                  rowClasses += 'bg-white dark:bg-surface-900 ';
                }
              }

              // Effetto hover per le non selezionate
              if (!isSelected) {
                rowClasses += 'hover:bg-surface-100 dark:hover:bg-surface-800/60 ';
              }

              if (this.clickable) {
                rowClasses += 'cursor-pointer ';
              }

              return html`
                <tr class="${rowClasses}" @click=${() => this.handleRowClick(row)}>
                  ${this.columns.map((col) => {
                    const alignClass =
                      col.align === 'center'
                        ? 'text-center'
                        : col.align === 'right'
                          ? 'text-right'
                          : 'text-left';
                    return html`
                      <td
                        class="${cellPadding} ${alignClass} text-sm text-surface-900 dark:text-surface-100"
                      >
                        ${this.getCellValue(row, col)}
                      </td>
                    `;
                  })}
                  ${this.actions.length > 0
                    ? html`
                        <td class="${cellPadding} text-right">
                          <div class="flex items-center justify-end gap-1">
                            ${this.actions
                              .filter((action) => !action.condition || action.condition(row))
                              .map(
                                (action) => html`
                                  <button
                                    type="button"
                                    class="p-2 rounded-lg transition-colors ${action.variant ===
                                    'danger'
                                      ? 'text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20'
                                      : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-300'}"
                                    title="${action.label}"
                                    @click=${(e: Event) => this.handleAction(action.action, row, e)}
                                  >
                                    <ui-icon name="${action.icon}" size="sm"></ui-icon>
                                  </button>
                                `,
                              )}
                          </div>
                        </td>
                      `
                    : nothing}
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}
