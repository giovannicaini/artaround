import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';
import './ui-badge';
import { __ } from '../../services/i18n.service';

/**
 * UI Tag Input
 *
 * A consistent input for managing a list of tags.
 *
 * @fires tags-change - Emits the updated tags array
 *
 * @example
 * ```html
 * <ui-tag-input
 *   label="Tags"
 *   placeholder="Add a tag..."
 *   .tags=${this.tags}
 *   @tags-change=${(e) => this.tags = e.detail.tags}
 * ></ui-tag-input>
 * ```
 */
@customElement('ui-tag-input')
export class UiTagInput extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: String }) placeholder = '';
  @property({ type: String }) emptyText = '';
  @property({ type: Array }) tags: string[] = [];
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) lowercase = true;

  @state() private inputValue = '';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && this.inputValue.trim()) {
      e.preventDefault();
      this.addTag();
    }
  }

  private handleInput(e: Event) {
    this.inputValue = (e.target as HTMLInputElement).value;
  }

  private addTag() {
    const rawTag = this.inputValue.trim();
    const tag = this.lowercase ? rawTag.toLowerCase() : rawTag;
    if (tag && !this.tags.includes(tag)) {
      const newTags = [...this.tags, tag];
      this.inputValue = '';
      this.dispatchEvent(
        new CustomEvent('tags-change', {
          detail: { tags: newTags },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private removeTag(tag: string) {
    const newTags = this.tags.filter((t) => t !== tag);
    this.dispatchEvent(
      new CustomEvent('tags-change', {
        detail: { tags: newTags },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const resolvedPlaceholder = this.placeholder || __('Aggiungi...');
    const resolvedEmptyText = this.emptyText || __('Nessun tag aggiunto');

    return html`
      <div class="space-y-2">
        ${this.label
          ? html`
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
                ${this.label}
              </label>
            `
          : nothing}

        <div class="flex gap-2">
          <div class="flex-1">
            <input
              type="text"
              class="w-full px-3 py-2 text-sm rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-900 dark:text-white placeholder-surface-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder=${resolvedPlaceholder}
              .value=${this.inputValue}
              ?disabled=${this.disabled}
              @input=${this.handleInput}
              @keydown=${this.handleKeydown}
            />
          </div>
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            ?disabled=${this.disabled || !this.inputValue.trim()}
            @click=${this.addTag}
          >
            <ui-icon name="plus" size="sm"></ui-icon>
          </button>
        </div>

        ${this.tags.length > 0
          ? html`
              <div class="flex flex-wrap gap-2">
                ${this.tags.map(
                  (tag) => html`
                    <span
                      class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300"
                    >
                      ${tag}
                      <button
                        type="button"
                        class="p-0.5 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-full transition-colors"
                        ?disabled=${this.disabled}
                        @click=${() => this.removeTag(tag)}
                      >
                        <ui-icon name="x" size="xs"></ui-icon>
                      </button>
                    </span>
                  `,
                )}
              </div>
            `
          : html`
              <p class="text-sm text-surface-500 dark:text-surface-400">${resolvedEmptyText}</p>
            `}
      </div>
    `;
  }
}
