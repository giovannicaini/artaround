import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-button';

@customElement('ui-pagination')
export class UiPagination extends LitElement {
  @property({ type: Number }) page = 1;
  @property({ type: Number }) totalPages = 1;
  @property({ type: Number }) maxVisible = 5;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'block';
  }

  private handlePageChange(newPage: number) {
    if (newPage < 1 || newPage > this.totalPages || newPage === this.page) return;
    this.dispatchEvent(
      new CustomEvent('page-change', {
        detail: { page: newPage },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private getVisiblePages(): (number | 'ellipsis')[] {
    const pages: (number | 'ellipsis')[] = [];
    const half = Math.floor(this.maxVisible / 2);

    let start = Math.max(1, this.page - half);
    let end = Math.min(this.totalPages, start + this.maxVisible - 1);

    if (end - start + 1 < this.maxVisible) {
      start = Math.max(1, end - this.maxVisible + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('ellipsis');
    }

    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== this.totalPages) {
        pages.push(i);
      } else if (start <= 1 && i === 1) {
        pages.push(i);
      } else if (end >= this.totalPages && i === this.totalPages) {
        pages.push(i);
      }
    }

    if (end < this.totalPages) {
      if (end < this.totalPages - 1) pages.push('ellipsis');
      pages.push(this.totalPages);
    }

    return pages;
  }

  render() {
    if (this.totalPages <= 1) return nothing;

    const visiblePages = this.getVisiblePages();

    return html`
      <div class="flex justify-center items-center gap-1 mt-6">
        <ui-button
          variant="ghost"
          icon="arrow-left"
          size="sm"
          ?disabled=${this.page === 1}
          @click=${() => this.handlePageChange(this.page - 1)}
        ></ui-button>

        ${visiblePages.map((p) =>
          p === 'ellipsis'
            ? html`<span class="px-2 text-surface-400">...</span>`
            : html`
                <ui-button
                  variant=${p === this.page ? 'primary' : 'ghost'}
                  size="sm"
                  label="${p}"
                  @click=${() => this.handlePageChange(p)}
                ></ui-button>
              `,
        )}

        <ui-button
          variant="ghost"
          icon="arrow-right"
          size="sm"
          ?disabled=${this.page === this.totalPages}
          @click=${() => this.handlePageChange(this.page + 1)}
        ></ui-button>
      </div>
    `;
  }
}
