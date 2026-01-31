import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ContentDuration, CompetenceLevel } from '@artaround/shared';
import type { ItemContent } from '@artaround/shared';
import '../ui/ui-select';
import '../ui/ui-textarea';
import '../ui/ui-icon';
import '../ui/ui-button';

interface ContentCell {
  duration: ContentDuration;
  language: CompetenceLevel;
  text: string;
  filled: boolean;
}

@customElement('content-matrix-editor')
export class ContentMatrixEditor extends LitElement {
  @property({ type: Array }) contents: ItemContent[] = [];
  
  @state() private matrix: ContentCell[][] = [];
  @state() private editingCell: { row: number; col: number } | null = null;
  @state() private editText = '';

  private durations = [
    { value: ContentDuration.SHORT, label: '3s - Breve' },
    { value: ContentDuration.MEDIUM, label: '15s - Media' },
    { value: ContentDuration.LONG, label: '40s - Lunga' },
    { value: ContentDuration.EXTENDED, label: '2min - Estesa' },
  ];

  private languages = [
    { value: CompetenceLevel.INFANTILE, label: 'Bambino' },
    { value: CompetenceLevel.SEMPLICE, label: 'Base' },
    { value: CompetenceLevel.MEDIO, label: 'Intermedio' },
    { value: CompetenceLevel.AVANZATO, label: 'Esperto' },
  ];

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.initializeMatrix();
  }

  private initializeMatrix() {
    // Create a 4x3 matrix (4 durations x 3 languages)
    this.matrix = this.durations.map(duration => 
      this.languages.map(language => {
        const existing = this.contents.find(
          c => c.duration === duration.value && c.language === language.value
        );
        return {
          duration: duration.value,
          language: language.value,
          text: existing?.text || '',
          filled: !!existing?.text
        };
      })
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
    const contents: ItemContent[] = this.matrix
      .flat()
      .filter(cell => cell.filled && cell.text)
      .map(cell => ({
        duration: cell.duration,
        language: cell.language,
        text: cell.text,
      }));
    
    this.dispatchEvent(new CustomEvent('contents-change', {
      detail: { contents },
      bubbles: true,
      composed: true
    }));
  }

  private getCellStatus(cell: ContentCell) {
    if (cell.filled && cell.text) {
      return 'filled';
    }
    return 'empty';
  }

  render() {
    return html`
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
            Contenuti per Durata × Livello
            <span class="text-danger-500 ml-0.5">*</span>
          </label>
          <span class="text-xs text-surface-500">
            ${this.matrix.flat().filter(c => c.filled).length} / ${this.matrix.flat().length} celle
          </span>
        </div>
        
        <!-- Matrix Grid -->
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr>
                <th class="p-2 text-left text-xs font-medium text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                  <div class="flex items-center gap-1">
                    <ui-icon name="clock" size="xs"></ui-icon>
                    Durata
                  </div>
                </th>
                ${this.languages.map(lang => html`
                  <th class="p-2 text-center text-xs font-medium text-surface-500 dark:text-surface-400 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 min-w-[120px]">
                    <div class="flex items-center justify-center gap-1">
                      <ui-icon name="users" size="xs"></ui-icon>
                      ${lang.label}
                    </div>
                  </th>
                `)}
              </tr>
            </thead>
            <tbody>
              ${this.durations.map((duration, rowIndex) => html`
                <tr>
                  <td class="p-2 text-xs font-medium text-surface-700 dark:text-surface-300 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
                    ${duration.label}
                  </td>
                  ${this.languages.map((_, colIndex) => {
                    const cell = this.matrix[rowIndex]?.[colIndex];
                    if (!cell) return '';
                    
                    const status = this.getCellStatus(cell);
                    
                    return html`
                      <td 
                        class="p-1 border border-surface-200 dark:border-surface-700 cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        @click=${() => this.openEditor(rowIndex, colIndex)}
                      >
                        <div class="h-16 flex items-center justify-center ${
                          status === 'filled' 
                            ? 'bg-success-50 dark:bg-success-900/20' 
                            : 'bg-surface-50 dark:bg-surface-800/50'
                        } rounded-lg">
                          ${status === 'filled' ? html`
                            <div class="text-center p-2">
                              <ui-icon name="check" size="sm" class="text-success-500 mx-auto mb-1"></ui-icon>
                              <p class="text-xs text-surface-600 dark:text-surface-400 line-clamp-2">
                                ${cell.text.substring(0, 50)}${cell.text.length > 50 ? '...' : ''}
                              </p>
                            </div>
                          ` : html`
                            <div class="text-center">
                              <ui-icon name="plus" size="sm" class="text-surface-300 dark:text-surface-600"></ui-icon>
                            </div>
                          `}
                        </div>
                      </td>
                    `;
                  })}
                </tr>
              `)}
            </tbody>
          </table>
        </div>
        
        <!-- Cell Editor Modal -->
        ${this.editingCell ? html`
          <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div class="bg-white dark:bg-surface-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-surface-900 dark:text-white">
                    Modifica Contenuto
                  </h3>
                  <p class="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
                    ${this.durations[this.editingCell.row].label} • ${this.languages[this.editingCell.col].label}
                  </p>
                </div>
                <button 
                  type="button"
                  class="p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 transition-colors"
                  @click=${this.closeEditor}
                >
                  <ui-icon name="x" size="sm"></ui-icon>
                </button>
              </div>
              
              <div class="p-4 space-y-4">
                <ui-textarea
                  label="Testo della descrizione"
                  placeholder="Inserisci il testo descrittivo per questa combinazione durata/livello..."
                  .value=${this.editText}
                  rows="8"
                  showCount
                  @textarea-change=${(e: CustomEvent) => this.editText = e.detail.value}
                ></ui-textarea>
                
                <!-- Word count estimate -->
                <div class="flex items-center gap-4 text-xs text-surface-500 dark:text-surface-400">
                  <span>~${Math.ceil(this.editText.split(/\s+/).filter(w => w).length / 150)} min lettura</span>
                  <span>${this.editText.split(/\s+/).filter(w => w).length} parole</span>
                </div>
              </div>
              
              <div class="p-4 border-t border-surface-200 dark:border-surface-700 flex justify-end gap-3">
                <ui-button
                  variant="secondary"
                  label="Annulla"
                  @click=${this.closeEditor}
                ></ui-button>
                <ui-button
                  variant="primary"
                  label="Salva"
                  icon="save"
                  @click=${this.saveCell}
                ></ui-button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
