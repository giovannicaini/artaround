import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-info-tip';
import { __ } from '../../services/i18n.service';

@customElement('ui-range-slider')
export class UiRangeSlider extends LitElement {
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) from = 0;
  @property({ type: Number }) to = 100;
  @property({ type: String }) label = '';
  @property({ type: String }) help = '';
  @property({ type: Boolean }) disabled = false;

  @state() private draggingHandle: 'from' | 'to' | null = null;

  private sliderRect: DOMRect | null = null;

  // ─── Ciclo di vita ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    super.disconnectedCallback();
  }

  // ─── Helper ──────────────────────────────────────────────
  private get safeSpan() {
    return Math.max(1, this.max - this.min);
  }

  private get safeFrom() {
    const bounded = Math.max(this.min, Math.min(this.max, this.from));
    return Math.min(bounded, this.safeTo);
  }

  private get safeTo() {
    const bounded = Math.max(this.min, Math.min(this.max, this.to));
    return Math.max(bounded, this.min);
  }

  private get fromPercent() {
    return ((this.safeFrom - this.min) / this.safeSpan) * 100;
  }

  private get toPercent() {
    return ((this.safeTo - this.min) / this.safeSpan) * 100;
  }

  private get inputsAreClose() {
    return Math.abs(this.toPercent - this.fromPercent) < 18;
  }

  // ─── Azioni ──────────────────────────────────────────────
  private emitChange(nextFrom: number, nextTo: number) {
    this.dispatchEvent(
      new CustomEvent('range-change', {
        detail: { from: nextFrom, to: nextTo },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private updateByPointer(clientX: number) {
    if (!this.sliderRect || !this.draggingHandle || this.disabled) return;

    const ratio = Math.max(
      0,
      Math.min(1, (clientX - this.sliderRect.left) / this.sliderRect.width),
    );
    const pointerValue = Math.round(this.min + ratio * this.safeSpan);

    if (this.draggingHandle === 'from') {
      this.emitChange(Math.min(pointerValue, this.safeTo), this.safeTo);
      return;
    }

    this.emitChange(this.safeFrom, Math.max(pointerValue, this.safeFrom));
  }

  private handleMouseMove = (e: MouseEvent) => {
    this.updateByPointer(e.clientX);
  };

  private handleMouseUp = () => {
    this.draggingHandle = null;
    this.sliderRect = null;
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (this.disabled) return;

    const slider = e.currentTarget as HTMLElement;
    const target = e.target as HTMLElement;
    const forcedHandle = target.dataset.handle as 'from' | 'to' | undefined;

    if (forcedHandle) {
      this.draggingHandle = forcedHandle;
    } else {
      const ratio = Math.max(
        0,
        Math.min(
          1,
          (e.clientX - slider.getBoundingClientRect().left) / slider.getBoundingClientRect().width,
        ),
      );
      const pointerValue = Math.round(this.min + ratio * this.safeSpan);
      this.draggingHandle =
        Math.abs(pointerValue - this.safeFrom) <= Math.abs(pointerValue - this.safeTo)
          ? 'from'
          : 'to';
    }

    this.sliderRect = slider.getBoundingClientRect();
    this.updateByPointer(e.clientX);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
  };

  private handleFromInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      this.emitChange(this.min, this.safeTo);
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;

    const bounded = Math.max(this.min, Math.min(this.max, Math.round(parsed)));
    this.emitChange(Math.min(bounded, this.safeTo), this.safeTo);
  }

  private handleToInput(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      this.emitChange(this.safeFrom, this.max);
      return;
    }

    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) return;

    const bounded = Math.max(this.min, Math.min(this.max, Math.round(parsed)));
    this.emitChange(this.safeFrom, Math.max(bounded, this.safeFrom));
  }

  // ─── Render ──────────────────────────────────────────────
  render() {
    return html`
      <div class="space-y-2 ${this.disabled ? 'opacity-60' : ''}">
        ${this.label
          ? html`
              <div class="flex items-center justify-between">
                <label
                  class="flex items-center gap-1.5 text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  ${this.label}
                  ${this.help ? html`<ui-info-tip text=${this.help}></ui-info-tip>` : nothing}
                </label>
              </div>
            `
          : nothing}

        <div class="space-y-2">
          <div class="relative h-10 select-none" @mousedown=${this.handleMouseDown}>
            <div
              class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-surface-200 dark:bg-surface-700"
            ></div>
            <div
              class="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-brand-500"
              style="left: ${this.fromPercent}%; width: ${Math.max(
                0,
                this.toPercent - this.fromPercent,
              )}%;"
            ></div>

            <button
              type="button"
              data-handle="from"
              class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-brand-500 bg-white dark:bg-surface-900 shadow-sm cursor-ew-resize"
              style="left: ${this.fromPercent}%;"
              aria-label=${__('Valore minimo')}
            ></button>

            <button
              type="button"
              data-handle="to"
              class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-brand-500 bg-white dark:bg-surface-900 shadow-sm cursor-ew-resize"
              style="left: ${this.toPercent}%;"
              aria-label=${__('Valore massimo')}
            ></button>
          </div>

          <div class="relative ${this.inputsAreClose ? 'h-16' : 'h-9'}">
            <div
              class="absolute top-0 w-14"
              style="left: clamp(0px, calc(${this.fromPercent}% - 1.75rem), calc(100% - 3.5rem));"
            >
              <input
                type="text"
                inputmode="numeric"
                pattern="-?[0-9]*"
                .value=${String(this.safeFrom)}
                class="w-full h-8 px-2 text-xs text-center rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                @input=${(e: Event) => this.handleFromInput((e.target as HTMLInputElement).value)}
                @blur=${(e: Event) => this.handleFromInput((e.target as HTMLInputElement).value)}
              />
            </div>

            <div
              class="absolute w-14 ${this.inputsAreClose ? 'top-8' : 'top-0'}"
              style="left: clamp(0px, calc(${this.toPercent}% - 1.75rem), calc(100% - 3.5rem));"
            >
              <input
                type="text"
                inputmode="numeric"
                pattern="-?[0-9]*"
                .value=${String(this.safeTo)}
                class="w-full h-8 px-2 text-xs text-center rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-white"
                @input=${(e: Event) => this.handleToInput((e.target as HTMLInputElement).value)}
                @blur=${(e: Event) => this.handleToInput((e.target as HTMLInputElement).value)}
              />
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
