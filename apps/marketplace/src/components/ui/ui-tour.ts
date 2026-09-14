import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-button';
import './ui-icon';
import { __ } from '../../services/i18n.service';

export interface TourSlide {
  icon: string;
  title: string;
  description: string;
  // Screenshot reale a corredo: quando presente sostituisce la grande icona come elemento centrale.
  image?: string;
}

/**
 * Pannello mobile per un tour a slide, non a schermo intero.
 */
@customElement('ui-tour')
export class UiTour extends LitElement {
  @property({ type: Array }) slides: TourSlide[] = [];

  @state() private step = 0;
  // null finché non si trascina mai: il pannello resta centrato via CSS.
  @state() private dragPos: { x: number; y: number } | null = null;

  private dragOffset = { x: 0, y: 0 };
  private dragging = false;

  createRenderRoot() {
    return this;
  }

  private get isLast(): boolean {
    return this.step === this.slides.length - 1;
  }

  private finish() {
    this.dispatchEvent(new CustomEvent('tour-finished', { bubbles: true, composed: true }));
  }

  private handleSkip() {
    this.finish();
  }

  private handleNext() {
    if (this.isLast) {
      this.finish();
      return;
    }
    this.step += 1;
  }

  // ─── Trascinamento ──────────────────────────────────────
  private handleDragStart = (e: PointerEvent) => {
    const panel = this.querySelector('.ui-tour-panel') as HTMLElement | null;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    // Prima volta che si trascina: passa da centrato-via-CSS a posizione
    // esplicita in px, partendo però da dove il pannello già si trova.
    if (!this.dragPos) {
      this.dragPos = { x: rect.left, y: rect.top };
    }
    this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    this.dragging = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  private handleDragMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const panel = this.querySelector('.ui-tour-panel') as HTMLElement | null;
    const width = panel?.offsetWidth ?? 0;
    const height = panel?.offsetHeight ?? 0;
    const maxX = Math.max(0, window.innerWidth - width);
    const maxY = Math.max(0, window.innerHeight - height);

    this.dragPos = {
      x: Math.min(Math.max(0, e.clientX - this.dragOffset.x), maxX),
      y: Math.min(Math.max(0, e.clientY - this.dragOffset.y), maxY),
    };
  };

  private handleDragEnd = () => {
    this.dragging = false;
  };

  render() {
    const slide = this.slides[this.step];
    if (!slide) return nothing;

    const showDots = this.slides.length <= 8;
    const positionStyle = this.dragPos
      ? `left:${this.dragPos.x}px; top:${this.dragPos.y}px;`
      : 'left:50%; top:6%; transform:translateX(-50%);';

    return html`
      <div
        class="ui-tour-panel fixed z-[100] w-[92vw] max-w-md sm:max-w-lg h-[34rem] max-h-[85vh] rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-strong flex flex-col animate-fade-in"
        style="${positionStyle}"
      >
        <div
          class="flex items-center justify-between px-3 py-2 border-b border-surface-100 dark:border-surface-800 cursor-move touch-none flex-shrink-0"
          @pointerdown=${this.handleDragStart}
          @pointermove=${this.handleDragMove}
          @pointerup=${this.handleDragEnd}
          @pointercancel=${this.handleDragEnd}
        >
          <ui-icon name="menu" size="xs" class="text-surface-300 dark:text-surface-600"></ui-icon>
          <button
            type="button"
            class="text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 font-medium px-2 py-1"
            @pointerdown=${(e: Event) => e.stopPropagation()}
            @click=${this.handleSkip}
          >
            ${__('Salta')}
          </button>
        </div>

        <div
          class="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-5 overflow-y-auto"
        >
          <div
            class="${slide.image
              ? 'w-11 h-11 mb-3'
              : 'w-16 h-16 mb-5'} rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-medium flex items-center justify-center flex-shrink-0"
          >
            <ui-icon name=${slide.icon} size="md" class="text-white"></ui-icon>
          </div>
          <h1 class="text-balance text-lg font-bold text-surface-900 dark:text-white mb-2 max-w-sm">
            ${slide.title}
          </h1>
          <p class="text-surface-500 dark:text-surface-400 text-sm leading-relaxed max-w-sm">
            ${slide.description}
          </p>
          ${slide.image
            ? html`
                <img
                  src=${slide.image}
                  alt=${slide.title}
                  class="mt-4 max-w-full max-h-40 w-auto rounded-xl border border-surface-200 dark:border-surface-800 shadow-medium object-contain object-top"
                />
              `
            : nothing}
        </div>

        <div class="px-6 pb-5 pt-1 flex-shrink-0">
          ${showDots
            ? html`
                <div class="flex justify-center gap-2 mb-4">
                  ${this.slides.map(
                    (_, index) => html`
                      <button
                        type="button"
                        aria-label=${`${__('Vai alla schermata')} ${index + 1}`}
                        class="w-2 h-2 rounded-full transition-all ${index === this.step
                          ? 'bg-brand-500 w-6'
                          : 'bg-surface-300 dark:bg-surface-700'}"
                        @click=${() => (this.step = index)}
                      ></button>
                    `,
                  )}
                </div>
              `
            : html`
                <div class="mb-4">
                  <div class="h-1 rounded-full bg-surface-200 dark:bg-surface-800 overflow-hidden">
                    <div
                      class="h-full bg-brand-500 transition-all"
                      style="width: ${((this.step + 1) / this.slides.length) * 100}%"
                    ></div>
                  </div>
                  <p class="text-center text-xs text-surface-400 mt-2">
                    ${this.step + 1} / ${this.slides.length}
                  </p>
                </div>
              `}

          <ui-button
            variant="primary"
            size="md"
            block
            .label=${this.isLast ? __('Inizia') : __('Avanti')}
            @click=${this.handleNext}
          ></ui-button>
        </div>
      </div>
    `;
  }
}
