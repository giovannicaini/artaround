import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  CONTENT_DURATION_MATRIX_OPTIONS_IT,
  LANGUAGE_LEVEL_SHORT_OPTIONS_IT,
  ContentDuration,
  LanguageLevel,
} from '@artaround/shared';
import '../ui/ui-select';
import '../ui/ui-textarea';
import '../ui/ui-icon';
import '../ui/ui-button';

/**
 * Content entry for the matrix
 * Each entry represents content for a specific duration + language level combination
 */
interface ContentEntry {
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  text: string;
}

interface ContentCell {
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  text: string;
  filled: boolean;
}

/**
 * Content Matrix Editor
 *
 * Provides a 2D grid editor for creating content at different
 * durations and language levels. Used for creating multiple Items
 * with the same reference but different characteristics.
 */
@customElement('content-matrix-editor')
export class ContentMatrixEditor extends LitElement {
  @property({ type: Array }) contentMatrix: ContentEntry[] = [];

  @state() private matrix: ContentCell[][] = [];
  @state() private editingCell: { row: number; col: number } | null = null;
  @state() private editText = '';

  private readonly durations = CONTENT_DURATION_MATRIX_OPTIONS_IT;

  private readonly languageLevels = LANGUAGE_LEVEL_SHORT_OPTIONS_IT;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.initializeMatrix();
  }

  private initializeMatrix() {
    // Create a 4x4 matrix (4 durations x 4 language levels)
    this.matrix = this.durations.map((duration) =>
      this.languageLevels.map((level) => {
        const existing = this.contentMatrix.find(
          (c) => c.duration === duration.value && c.languageLevel === level.value,
        );
        return {
          duration: duration.value,
          languageLevel: level.value,
          text: existing?.text || '',
          filled: !!existing?.text,
        };
      }),
    );
  }

  private openEditor(row: number, col: number) {
    this.editingCell = { row, col };
    this.editText = this.matrix[row][col].text;
  }

  private closeEditor() {
    this.editingCell = null;
    this.editText = '';
  }

  private saveCell() {
    if (!this.editingCell) return;

    const { row, col } = this.editingCell;
    this.matrix[row][col].text = this.editText;
    this.matrix[row][col].filled = !!this.editText;
    this.matrix = [...this.matrix]; // Trigger reactivity

    this.emitChange();
    this.closeEditor();
  }

  private emitChange() {
    const entries: ContentEntry[] = this.matrix
      .flat()
      .filter((cell) => cell.filled && cell.text)
      .map((cell) => ({
        duration: cell.duration,
        languageLevel: cell.languageLevel,
        text: cell.text,
      }));

    this.dispatchEvent(
      new CustomEvent('contents-change', {
        detail: { entries },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="content-matrix-editor">
        <h3 class="text-lg font-semibold mb-4">Matrice dei contenuti</h3>
        <p class="text-sm text-gray-500 mb-4">
          Crea versioni del contenuto a diverse durate e livelli linguistici. Clicca su una cella
          per modificarla.
        </p>

        <!-- Matrix Grid -->
        <div class="overflow-x-auto">
          <table class="min-w-full border-collapse">
            <thead>
              <tr>
                <th class="p-2 border bg-gray-100"></th>
                ${this.languageLevels.map(
                  (level) => html`
                    <th class="p-2 border bg-gray-100 text-sm font-medium">${level.label}</th>
                  `,
                )}
              </tr>
            </thead>
            <tbody>
              ${this.matrix.map(
                (row, rowIndex) => html`
                  <tr>
                    <td class="p-2 border bg-gray-100 text-sm font-medium">
                      ${this.durations[rowIndex].label}
                    </td>
                    ${row.map(
                      (cell, colIndex) => html`
                        <td
                          class="p-2 border cursor-pointer hover:bg-blue-50 transition-colors ${cell.filled
                            ? 'bg-green-50'
                            : 'bg-white'}"
                          @click=${() => this.openEditor(rowIndex, colIndex)}
                        >
                          <div class="flex items-center justify-center h-12">
                            ${cell.filled
                              ? html` <ui-icon name="check" class="text-green-600"></ui-icon> `
                              : html` <ui-icon name="plus" class="text-gray-400"></ui-icon> `}
                          </div>
                        </td>
                      `,
                    )}
                  </tr>
                `,
              )}
            </tbody>
          </table>
        </div>

        <!-- Cell Editor Modal -->
        ${this.editingCell
          ? html`
              <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4">
                  <h4 class="text-lg font-semibold mb-2">
                    ${this.durations[this.editingCell.row].label} -
                    ${this.languageLevels[this.editingCell.col].label}
                  </h4>
                  <p class="text-sm text-gray-500 mb-4">
                    Scrivi il contenuto per questa combinazione di durata e livello.
                  </p>

                  <textarea
                    class="w-full h-48 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Inserisci il testo del contenuto..."
                    .value=${this.editText}
                    @input=${(e: Event) => {
                      this.editText = (e.target as HTMLTextAreaElement).value;
                    }}
                  ></textarea>

                  <div class="flex justify-end gap-2 mt-4">
                    <ui-button variant="ghost" @click=${this.closeEditor}> Annulla </ui-button>
                    <ui-button variant="primary" @click=${this.saveCell}> Salva </ui-button>
                  </div>
                </div>
              </div>
            `
          : ''}

        <!-- Summary -->
        <div class="mt-4 text-sm text-gray-600">
          Celle compilate: ${this.matrix.flat().filter((c) => c.filled).length} /
          ${this.matrix.flat().length}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'content-matrix-editor': ContentMatrixEditor;
  }
}
