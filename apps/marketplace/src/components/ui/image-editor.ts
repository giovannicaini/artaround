import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { uploadService } from '../../services/upload.service';
import type { UploadCategory, ImageProcessOptions } from '@artaround/shared';
import '../ui/ui-button';
import '../ui/ui-icon';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-badge';
import '../ui/ui-image-placeholder';
import { __ } from '../../services/i18n.service';

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SourceMode = 'file' | 'url';
type EditorStep = 'source' | 'edit' | 'uploading';

/**
 * Reusable Image Editor Component
 *
 * Features:
 * - Load image from file or URL
 * - Preview with resize controls
 * - Visual crop selection
 * - Format and quality selection
 * - Upload to server with processing
 *
 * Usage:
 * <image-editor
 *   category="museums"
 *   .value=${museum.coverImage}
 *   @image-saved=${(e) => handle(e.detail.path)}
 * ></image-editor>
 */
@customElement('image-editor')
export class ImageEditor extends LitElement {
  /** Upload category (determines server subfolder) */
  @property({ type: String }) category: UploadCategory = 'misc';

  /** Current image path/URL (for displaying current image and replacing) */
  @property({ type: String }) value = '';

  /** Label shown above the component */
  @property({ type: String }) label = '';

  /** Whether this field is required */
  @property({ type: Boolean }) required = false;

  /** Suggested max width for the output */
  @property({ type: Number }) maxWidth = 1200;

  /** Suggested max height for the output */
  @property({ type: Number }) maxHeight = 1200;

  /** Default output format */
  @property({ type: String }) defaultFormat: 'webp' | 'jpeg' | 'png' = 'webp';

  /** Max output size in MB (0 = no limit) */
  @property({ type: Number }) maxOutputSizeMb = 0;

  // Internal state
  @state() private step: EditorStep = 'source';
  @state() private sourceMode: SourceMode = 'file';
  @state() private urlInput = '';
  @state() private showSourcePicker = false;

  // Loaded image state
  @state() private imageFile: File | null = null;
  @state() private imageDataUrl = '';
  @state() private originalWidth = 0;
  @state() private originalHeight = 0;

  // Edit controls
  @state() private targetWidth = 0;
  @state() private targetHeight = 0;
  @state() private lockAspectRatio = true;
  @state() private outputFormat: 'webp' | 'jpeg' | 'png' = 'webp';
  @state() private outputQuality = 85;

  // Crop state
  @state() private cropEnabled = false;
  @state() private crop: CropRegion = { x: 0, y: 0, width: 0, height: 0 };
  @state() private dragging = false;
  @state() private dragType: 'move' | 'nw' | 'ne' | 'sw' | 'se' | null = null;
  @state() private dragStartX = 0;
  @state() private dragStartY = 0;
  @state() private dragStartCrop: CropRegion = { x: 0, y: 0, width: 0, height: 0 };

  // Upload state
  @state() private uploading = false;
  @state() private error = '';
  @state() private estimatedOutputSizeBytes = 0;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.outputFormat = this.defaultFormat;
    // Bind global mouse handlers for crop drag
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  updated(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has('originalWidth') ||
      changedProperties.has('originalHeight') ||
      changedProperties.has('targetWidth') ||
      changedProperties.has('targetHeight') ||
      changedProperties.has('cropEnabled') ||
      changedProperties.has('crop') ||
      changedProperties.has('outputFormat') ||
      changedProperties.has('outputQuality')
    ) {
      this.refreshEstimatedOutputSize();
    }
  }

  private get aspectRatio(): number {
    if (this.originalHeight === 0) return 1;
    return this.originalWidth / this.originalHeight;
  }

  private get maxOutputSizeBytes(): number {
    return this.maxOutputSizeMb > 0 ? Math.round(this.maxOutputSizeMb * 1024 * 1024) : 0;
  }

  private get isEstimateOverLimit(): boolean {
    return this.maxOutputSizeBytes > 0 && this.estimatedOutputSizeBytes > this.maxOutputSizeBytes;
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private refreshEstimatedOutputSize() {
    if (!this.originalWidth || !this.originalHeight) {
      this.estimatedOutputSizeBytes = 0;
      return;
    }

    const useCrop = this.cropEnabled || this.hasCustomCropRegion();
    const sourceWidth = useCrop ? Math.max(1, this.crop.width) : this.originalWidth;
    const sourceHeight = useCrop ? Math.max(1, this.crop.height) : this.originalHeight;

    const outputWidth = Math.max(1, this.targetWidth || sourceWidth);
    const outputHeight = Math.max(1, this.targetHeight || sourceHeight);

    const pixelCount = outputWidth * outputHeight;
    const rawRgbaBytes = pixelCount * 4;

    const qualityRatio = Math.max(0.1, Math.min(1, this.outputQuality / 100));

    let compressionFactor = 0.2;
    if (this.outputFormat === 'webp') {
      compressionFactor = 0.04 + qualityRatio * 0.12;
    } else if (this.outputFormat === 'jpeg') {
      compressionFactor = 0.06 + qualityRatio * 0.16;
    } else if (this.outputFormat === 'png') {
      compressionFactor = 0.28;
    }

    // Make estimate responsive to crop changes even when output width/height are fixed.
    // Smaller crop areas usually reduce encoded complexity and final size.
    const originalArea = Math.max(1, this.originalWidth * this.originalHeight);
    const croppedArea = Math.max(1, sourceWidth * sourceHeight);
    const cropRatio = Math.max(0.05, Math.min(1, croppedArea / originalArea));
    const cropComplexityFactor = 0.55 + 0.45 * Math.sqrt(cropRatio);

    this.estimatedOutputSizeBytes = Math.max(
      1024,
      Math.round(rawRgbaBytes * compressionFactor * cropComplexityFactor),
    );
  }

  private getOutputDimensions(): { width: number; height: number } {
    const useCrop = this.cropEnabled || this.hasCustomCropRegion();
    const sourceWidth = useCrop ? Math.max(1, this.crop.width) : Math.max(1, this.originalWidth);
    const sourceHeight = useCrop ? Math.max(1, this.crop.height) : Math.max(1, this.originalHeight);

    return {
      width: Math.max(1, this.targetWidth || sourceWidth),
      height: Math.max(1, this.targetHeight || sourceHeight),
    };
  }

  private async editCurrentImage() {
    const currentUrl = uploadService.getImageUrl(this.value);
    if (!currentUrl) {
      this.error = __('Nessuna immagine da modificare');
      return;
    }

    this.error = '';
    this.showSourcePicker = false;
    this.imageFile = null;

    try {
      await this.loadImageDimensions(currentUrl);
      this.imageDataUrl = currentUrl;
    } catch {
      this.error = __("Impossibile caricare l'immagine corrente per la modifica");
    }
  }

  // ─── Actions ──────────────────────────────────────────────

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.loadFile(input.files[0]);
    }
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.loadFile(files[0]);
    }
  }

  private loadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.error = __("Il file deve essere un'immagine");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      this.error = __('Il file è troppo grande (max 20MB)');
      return;
    }

    this.error = '';
    this.imageFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.imageDataUrl = reader.result as string;
      this.loadImageDimensions(this.imageDataUrl);
    };
    reader.readAsDataURL(file);
  }

  private async loadFromUrl() {
    const normalizedUrl = this.urlInput.trim();

    if (!normalizedUrl) {
      this.error = __('Inserisci un URL valido');
      return;
    }

    if (!/^https?:\/\//i.test(normalizedUrl)) {
      this.error = __("L'URL deve iniziare con http:// o https://");
      return;
    }

    this.error = '';

    try {
      // Try to load the image to get dimensions
      await this.loadImageDimensions(normalizedUrl);
      this.imageDataUrl = normalizedUrl;
      this.imageFile = null; // URL mode, no local file
    } catch {
      // Fallback for ORB/CORS/hotlink blocks: import directly server-side
      this.uploading = true;

      try {
        const options: ImageProcessOptions = {
          width: this.maxWidth || undefined,
          height: this.maxHeight || undefined,
          fit: 'inside',
          quality: this.outputQuality,
          format: this.outputFormat,
        };

        const oldPath = this.value && this.value.startsWith('/uploads/') ? this.value : undefined;
        const result = await uploadService.uploadFromUrl(
          normalizedUrl,
          this.category,
          options,
          oldPath,
        );

        if (result.success && result.data) {
          this.dispatchEvent(
            new CustomEvent('image-saved', {
              detail: result.data,
              bubbles: true,
              composed: true,
            }),
          );
          this.resetEditor();
        } else {
          this.error =
            typeof result.error === 'string'
              ? result.error
              : __("Impossibile caricare l'immagine dall'URL");
        }
      } catch {
        this.error = __("Impossibile caricare l'immagine dall'URL");
      } finally {
        this.uploading = false;
      }
    }
  }

  private loadImageDimensions(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.originalWidth = img.naturalWidth;
        this.originalHeight = img.naturalHeight;

        // Set initial target to fit within maxWidth/maxHeight
        const scale = Math.min(
          1,
          this.maxWidth / img.naturalWidth,
          this.maxHeight / img.naturalHeight,
        );
        this.targetWidth = Math.round(img.naturalWidth * scale);
        this.targetHeight = Math.round(img.naturalHeight * scale);

        // Reset crop to full image
        this.crop = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
        this.cropEnabled = false;

        this.step = 'edit';
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  }

  // ─── Helpers ──────────────────────────────────────────────

  private handleWidthChange(e: CustomEvent) {
    const w = parseInt(e.detail.value, 10) || 0;
    this.targetWidth = w;
    if (this.lockAspectRatio && this.aspectRatio > 0) {
      this.targetHeight = Math.round(w / this.aspectRatio);
    }
  }

  private handleHeightChange(e: CustomEvent) {
    const h = parseInt(e.detail.value, 10) || 0;
    this.targetHeight = h;
    if (this.lockAspectRatio && this.aspectRatio > 0) {
      this.targetWidth = Math.round(h * this.aspectRatio);
    }
  }

  private toggleAspectLock() {
    this.lockAspectRatio = !this.lockAspectRatio;
  }

  private toggleCrop() {
    this.cropEnabled = !this.cropEnabled;
    if (this.cropEnabled && !this.hasCustomCropRegion()) {
      // Set initial crop to center 80% region
      const cw = Math.round(this.originalWidth * 0.8);
      const ch = Math.round(this.originalHeight * 0.8);
      this.crop = {
        x: Math.round((this.originalWidth - cw) / 2),
        y: Math.round((this.originalHeight - ch) / 2),
        width: cw,
        height: ch,
      };
    }
  }

  private hasCustomCropRegion(): boolean {
    if (!this.originalWidth || !this.originalHeight) return false;

    return (
      this.crop.x > 0 ||
      this.crop.y > 0 ||
      this.crop.width < this.originalWidth ||
      this.crop.height < this.originalHeight
    );
  }

  private resetCrop() {
    this.crop = { x: 0, y: 0, width: this.originalWidth, height: this.originalHeight };
  }

  // ─── Actions ──────────────────────────────────────────────

  private getImageElement(): HTMLImageElement | null {
    return this.querySelector('.image-editor-preview') as HTMLImageElement;
  }

  private getScaleFactor(): number {
    const img = this.getImageElement();
    if (!img) return 1;
    return this.originalWidth / img.clientWidth;
  }

  private startCropDrag(e: MouseEvent, type: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
    e.preventDefault();
    e.stopPropagation();
    this.dragging = true;
    this.dragType = type;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartCrop = { ...this.crop };

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);
  }

  private _onMouseMove(e: MouseEvent) {
    if (!this.dragging) return;

    const scale = this.getScaleFactor();
    const dx = (e.clientX - this.dragStartX) * scale;
    const dy = (e.clientY - this.dragStartY) * scale;
    const sc = this.dragStartCrop;

    let { x, y, width, height } = this.crop;

    if (this.dragType === 'move') {
      x = Math.max(0, Math.min(this.originalWidth - sc.width, sc.x + dx));
      y = Math.max(0, Math.min(this.originalHeight - sc.height, sc.y + dy));
      width = sc.width;
      height = sc.height;
    } else if (this.dragType === 'se') {
      width = Math.max(50 * scale, Math.min(this.originalWidth - sc.x, sc.width + dx));
      height = Math.max(50 * scale, Math.min(this.originalHeight - sc.y, sc.height + dy));
      x = sc.x;
      y = sc.y;
    } else if (this.dragType === 'sw') {
      const newW = Math.max(50 * scale, sc.width - dx);
      x = sc.x + sc.width - newW;
      if (x < 0) {
        x = 0;
      }
      width = sc.x + sc.width - x;
      height = Math.max(50 * scale, Math.min(this.originalHeight - sc.y, sc.height + dy));
      y = sc.y;
    } else if (this.dragType === 'ne') {
      width = Math.max(50 * scale, Math.min(this.originalWidth - sc.x, sc.width + dx));
      x = sc.x;
      const newH = Math.max(50 * scale, sc.height - dy);
      y = sc.y + sc.height - newH;
      if (y < 0) {
        y = 0;
      }
      height = sc.y + sc.height - y;
    } else if (this.dragType === 'nw') {
      const newW = Math.max(50 * scale, sc.width - dx);
      x = sc.x + sc.width - newW;
      if (x < 0) {
        x = 0;
      }
      width = sc.x + sc.width - x;
      const newH = Math.max(50 * scale, sc.height - dy);
      y = sc.y + sc.height - newH;
      if (y < 0) {
        y = 0;
      }
      height = sc.y + sc.height - y;
    }

    this.crop = {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  private _onMouseUp() {
    this.dragging = false;
    this.dragType = null;
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
  }

  // ─── Actions ──────────────────────────────────────────────

  private async handleSave() {
    this.uploading = true;
    this.error = '';

    if (this.isEstimateOverLimit) {
      this.error = `La stima (${this.formatBytes(this.estimatedOutputSizeBytes)}) supera il massimo consentito (${this.formatBytes(this.maxOutputSizeBytes)}).`;
      this.uploading = false;
      return;
    }

    try {
      const options: ImageProcessOptions = {
        width: this.targetWidth || undefined,
        height: this.targetHeight || undefined,
        fit: 'cover',
        quality: this.outputQuality,
        format: this.outputFormat,
      };

      // Apply crop whenever there is an active crop selection
      if (this.cropEnabled || this.hasCustomCropRegion()) {
        options.cropX = this.crop.x;
        options.cropY = this.crop.y;
        options.cropWidth = this.crop.width;
        options.cropHeight = this.crop.height;
      }

      // Determine old path for replacement
      const oldPath = this.value && this.value.startsWith('/uploads/') ? this.value : undefined;
      const oldPathForUpload = this.maxOutputSizeBytes > 0 ? undefined : oldPath;

      let result;
      if (this.imageFile) {
        // File upload
        result = await uploadService.uploadFile(
          this.imageFile,
          this.category,
          options,
          oldPathForUpload,
        );
      } else if (this.imageDataUrl) {
        // URL upload
        result = await uploadService.uploadFromUrl(
          this.imageDataUrl,
          this.category,
          options,
          oldPathForUpload,
        );
      } else {
        this.error = __('Nessuna immagine da salvare');
        this.uploading = false;
        return;
      }

      if (result.success && result.data) {
        if (this.maxOutputSizeBytes > 0 && result.data.size > this.maxOutputSizeBytes) {
          if (result.data.path?.startsWith('/uploads/')) {
            await uploadService.deleteImage(result.data.path);
          }
          this.error = `L'immagine elaborata pesa ${this.formatBytes(result.data.size)} e supera il massimo consentito (${this.formatBytes(this.maxOutputSizeBytes)}).`;
          return;
        }

        if (oldPath && oldPathForUpload === undefined && oldPath !== result.data.path) {
          await uploadService.deleteImage(oldPath);
        }

        this.dispatchEvent(
          new CustomEvent('image-saved', {
            detail: result.data,
            bubbles: true,
            composed: true,
          }),
        );
        // Reset to source view
        this.resetEditor();
      } else {
        this.error =
          typeof result.error === 'string' ? result.error : __('Errore durante il caricamento');
      }
    } catch {
      this.error = __('Errore durante il caricamento');
    } finally {
      this.uploading = false;
    }
  }

  private async handleRemove() {
    if (this.value && this.value.startsWith('/uploads/')) {
      await uploadService.deleteImage(this.value);
    }
    this.dispatchEvent(
      new CustomEvent('image-saved', {
        detail: { path: '', width: 0, height: 0, size: 0, mimeType: '', originalName: '' },
        bubbles: true,
        composed: true,
      }),
    );
    this.resetEditor();
  }

  private resetEditor() {
    this.step = 'source';
    this.imageFile = null;
    this.imageDataUrl = '';
    this.urlInput = '';
    this.showSourcePicker = false;
    this.originalWidth = 0;
    this.originalHeight = 0;
    this.cropEnabled = false;
    this.estimatedOutputSizeBytes = 0;
    this.error = '';
  }

  private cancelEdit() {
    this.resetEditor();
  }

  // ─── Render ────────────────────────────────────────────────

  render() {
    const resolvedLabel = this.label || __('Immagine');

    return html`
      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
          ${resolvedLabel}
          ${this.required ? html`<span class="text-danger-500 ml-0.5">*</span>` : nothing}
        </label>

        ${this.value && this.step === 'source' && !this.showSourcePicker
          ? this.renderCurrentImage()
          : this.step === 'edit'
            ? this.renderEditor()
            : this.renderSourcePicker()}
        ${this.error
          ? html`
              <p
                class="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1"
                role="alert"
              >
                <ui-icon name="warning" size="xs"></ui-icon>
                ${this.error}
              </p>
            `
          : nothing}
      </div>
    `;
  }

  private renderCurrentImage() {
    const imageAttrs = uploadService.getResponsiveImageAttrs(this.value, {
      widths: [480, 768, 1200],
      sizes: '(max-width: 768px) 100vw, 600px',
    });

    return html`
      <div
        class="relative rounded-lg overflow-hidden border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800"
      >
        <img
          src="${imageAttrs.src}"
          srcset="${ifDefined(imageAttrs.srcset)}"
          sizes="${ifDefined(imageAttrs.sizes)}"
          alt=${__('Immagine corrente')}
          class="w-full h-48 object-contain"
          @error=${(e: Event) => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            img.parentElement?.querySelector('ui-image-placeholder')?.removeAttribute('hidden');
          }}
        />
        <ui-image-placeholder
          type="default"
          size="lg"
          hidden
          class="w-full h-48"
        ></ui-image-placeholder>
        <div
          class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex flex-wrap justify-end gap-2"
        >
          <ui-button
            variant="primary"
            size="sm"
            .label=${__('Modifica')}
            icon="edit"
            @click=${this.editCurrentImage}
          ></ui-button>
          <ui-button
            variant="secondary"
            size="sm"
            .label=${__('Sostituisci')}
            icon="upload"
            @click=${() => {
              this.step = 'source';
              this.showSourcePicker = true;
              this.error = '';
            }}
          ></ui-button>
          <ui-button
            variant="danger"
            size="sm"
            .label=${__('Rimuovi')}
            icon="trash"
            @click=${this.handleRemove}
          ></ui-button>
        </div>
      </div>
    `;
  }

  private renderSourcePicker() {
    return html`
      <div
        class="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden"
      >
        <!-- Tabs: File / URL -->
        <div class="flex border-b border-surface-200 dark:border-surface-700">
          <button
            type="button"
            class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors
              ${this.sourceMode === 'file'
              ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
              : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'}"
            @click=${() => {
              this.sourceMode = 'file';
              this.error = '';
            }}
          >
            <span class="flex items-center justify-center gap-1.5">
              <ui-icon name="upload" size="xs"></ui-icon>
              ${__('File locale')}
            </span>
          </button>
          <button
            type="button"
            class="flex-1 px-4 py-2.5 text-sm font-medium transition-colors
              ${this.sourceMode === 'url'
              ? 'text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
              : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800'}"
            @click=${() => {
              this.sourceMode = 'url';
              this.error = '';
            }}
          >
            <span class="flex items-center justify-center gap-1.5">
              <ui-icon name="globe" size="xs"></ui-icon>
              ${__('Da URL')}
            </span>
          </button>
        </div>

        <div class="p-4">
          ${this.sourceMode === 'file' ? this.renderFilePicker() : this.renderUrlPicker()}
        </div>

        ${this.value
          ? html`
              <div class="px-4 pb-3">
                <button
                  type="button"
                  class="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                  @click=${() => {
                    this.showSourcePicker = false;
                    this.error = '';
                  }}
                >
                  ${`← ${__("Torna all'immagine corrente")}`}
                </button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderFilePicker() {
    return html`
      <div
        class="border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer
          border-surface-300 dark:border-surface-600 hover:border-brand-400 dark:hover:border-brand-500
          hover:bg-brand-50/30 dark:hover:bg-brand-900/10"
        @dragover=${this.handleDragOver}
        @drop=${this.handleDrop}
        @click=${() => this.querySelector<HTMLInputElement>('.image-editor-file-input')?.click()}
      >
        <input
          type="file"
          accept="image/*"
          class="sr-only image-editor-file-input"
          @change=${this.handleFileSelect}
        />
        <div class="text-center">
          <ui-icon
            name="upload"
            size="lg"
            class="text-surface-400 dark:text-surface-500 mx-auto mb-3"
          ></ui-icon>
          <p class="text-sm text-surface-600 dark:text-surface-400 mb-1">
            <span class="text-brand-600 dark:text-brand-400 font-medium"
              >${__('Clicca per caricare')}</span
            >
            ${__('o trascina qui')}
          </p>
          <p class="text-xs text-surface-500">PNG, JPG, WebP, GIF — max 20MB</p>
        </div>
      </div>
    `;
  }

  private renderUrlPicker() {
    return html`
      <div class="space-y-3">
        <ui-input
          label=""
          .placeholder=${__('https://example.com/immagine.jpg')}
          .value=${this.urlInput}
          @input-change=${(e: CustomEvent) => {
            this.urlInput = e.detail.value;
          }}
        ></ui-input>
        <ui-button
          type="button"
          variant="primary"
          size="sm"
          .label=${__('Carica da URL')}
          icon="download"
          .loading=${this.uploading}
          ?disabled=${this.uploading}
          @click=${this.loadFromUrl}
        ></ui-button>
      </div>
    `;
  }

  // ─── Render Helpers ──────────────────────────────────────

  private renderEditor() {
    //const scaleFactor = this.originalWidth > 0 ? 100 / this.originalWidth : 1;
    const outputDimensions = this.getOutputDimensions();

    return html`
      <div
        class="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 overflow-hidden"
      >
        <!-- Preview Area -->
        <div
          class="relative bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)_0_0/20px_20px] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)_0_0/20px_20px] flex items-center justify-center p-4"
        >
          <div class="relative inline-block max-w-full">
            <img
              src="${this.imageDataUrl}"
              alt="Anteprima"
              class="image-editor-preview max-w-full max-h-80 block select-none"
              draggable="false"
            />
            ${this.cropEnabled ? this.renderCropOverlay() : nothing}
          </div>
        </div>

        <!-- Controls -->
        <div class="p-4 space-y-4 border-t border-surface-200 dark:border-surface-700">
          <!-- Original info bar -->
          <div class="flex items-center gap-2 flex-wrap">
            <ui-badge
              variant="secondary"
              .label=${__('Originale') +
              ': ' +
              this.originalWidth +
              '×' +
              this.originalHeight +
              'px'}
              size="sm"
            ></ui-badge>
            <ui-badge
              variant="outline"
              .label=${'Output: ' + outputDimensions.width + '×' + outputDimensions.height + 'px'}
              size="sm"
            ></ui-badge>
            <ui-badge
              variant=${this.isEstimateOverLimit ? 'danger' : 'outline'}
              .label=${__('Stima file') + ': ' + this.formatBytes(this.estimatedOutputSizeBytes)}
              size="sm"
            ></ui-badge>
            ${this.maxOutputSizeBytes > 0
              ? html`
                  <ui-badge
                    variant="outline"
                    .label=${'Max: ' + this.formatBytes(this.maxOutputSizeBytes)}
                    size="sm"
                  ></ui-badge>
                `
              : nothing}
            ${this.cropEnabled
              ? html`
                  <ui-badge
                    variant="primary"
                    .label=${'Ritaglio: ' + this.crop.width + '×' + this.crop.height + 'px'}
                    size="sm"
                  ></ui-badge>
                `
              : nothing}
          </div>

          <!-- Resize controls -->
          <div class="flex items-end gap-3 flex-wrap">
            <div class="w-28">
              <ui-input
                .label=${__('Larghezza')}
                type="number"
                .value=${String(this.targetWidth)}
                @input-change=${this.handleWidthChange}
              ></ui-input>
            </div>

            <button
              type="button"
              class="mb-2 p-1.5 rounded transition-colors
                ${this.lockAspectRatio
                ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30'
                : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'}"
              title="${this.lockAspectRatio
                ? __('Proporzioni bloccate')
                : __('Proporzioni libere')}"
              @click=${this.toggleAspectLock}
            >
              <ui-icon name="link" size="xs"></ui-icon>
            </button>

            <div class="w-28">
              <ui-input
                .label=${__('Altezza')}
                type="number"
                .value=${String(this.targetHeight)}
                @input-change=${this.handleHeightChange}
              ></ui-input>
            </div>

            <div class="w-28">
              <ui-select
                .label=${__('Formato')}
                .value=${this.outputFormat}
                .options=${[
                  { value: 'webp', label: 'WebP' },
                  { value: 'jpeg', label: 'JPEG' },
                  { value: 'png', label: 'PNG' },
                ]}
                @select-change=${(e: CustomEvent) => {
                  this.outputFormat = e.detail.value;
                }}
              ></ui-select>
            </div>

            <div class="w-24">
              <label
                class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5"
              >
                ${__('Qualità')}
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  .value=${String(this.outputQuality)}
                  @input=${(e: Event) => {
                    this.outputQuality = parseInt((e.target as HTMLInputElement).value, 10);
                  }}
                  class="w-full accent-brand-500"
                />
                <span class="text-xs text-surface-500 w-8 text-right">${this.outputQuality}</span>
              </div>
            </div>
          </div>

          <!-- Crop toggle -->
          <div class="flex items-center gap-3">
            <ui-button
              variant=${this.cropEnabled ? 'primary' : 'outline'}
              size="sm"
              .label=${this.cropEnabled ? __('Ritaglio attivo') : __('Ritaglia')}
              icon="image"
              @click=${this.toggleCrop}
            ></ui-button>
            ${this.cropEnabled
              ? html`
                  <ui-button
                    variant="secondary"
                    size="sm"
                    .label=${__('Seleziona tutto')}
                    @click=${this.resetCrop}
                  ></ui-button>
                `
              : nothing}
          </div>

          <!-- Action buttons -->
          <div
            class="flex items-center gap-3 pt-2 border-t border-surface-200 dark:border-surface-700"
          >
            <ui-button
              variant="primary"
              .label=${__('Salva immagine')}
              icon="save"
              .loading=${this.uploading}
              ?disabled=${this.uploading || this.isEstimateOverLimit}
              @click=${this.handleSave}
            ></ui-button>
            <ui-button
              variant="secondary"
              .label=${__('Annulla')}
              @click=${this.cancelEdit}
            ></ui-button>
          </div>
        </div>
      </div>
    `;
  }

  private renderCropOverlay() {
    const img = this.getImageElement();
    if (!img) return nothing;

    const displayW = img.clientWidth;
    const displayH = img.clientHeight;
    const scaleX = displayW / this.originalWidth;
    const scaleY = displayH / this.originalHeight;

    const cx = this.crop.x * scaleX;
    const cy = this.crop.y * scaleY;
    const cw = this.crop.width * scaleX;
    const ch = this.crop.height * scaleY;

    const handleSize = 10;

    return html`
      <!-- Dark overlay outside crop -->
      <div
        class="absolute inset-0 pointer-events-none"
        style="background:
        linear-gradient(to right, rgba(0,0,0,0.5) ${cx}px, transparent ${cx}px, transparent ${cx +
        cw}px, rgba(0,0,0,0.5) ${cx + cw}px);"
      ></div>
      <div
        class="absolute pointer-events-none"
        style="left:${cx}px; top:0; width:${cw}px; height:${cy}px; background:rgba(0,0,0,0.5)"
      ></div>
      <div
        class="absolute pointer-events-none"
        style="left:${cx}px; top:${cy + ch}px; width:${cw}px; bottom:0; background:rgba(0,0,0,0.5)"
      ></div>

      <!-- Crop region (draggable) -->
      <div
        class="absolute border-2 border-white cursor-move"
        style="left:${cx}px; top:${cy}px; width:${cw}px; height:${ch}px; box-shadow: 0 0 0 9999px rgba(0,0,0,0);"
        @mousedown=${(e: MouseEvent) => this.startCropDrag(e, 'move')}
      >
        <!-- Rule of thirds guides -->
        <div class="absolute inset-0 pointer-events-none">
          <div
            class="absolute"
            style="left:33.33%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.3)"
          ></div>
          <div
            class="absolute"
            style="left:66.66%; top:0; bottom:0; width:1px; background:rgba(255,255,255,0.3)"
          ></div>
          <div
            class="absolute"
            style="top:33.33%; left:0; right:0; height:1px; background:rgba(255,255,255,0.3)"
          ></div>
          <div
            class="absolute"
            style="top:66.66%; left:0; right:0; height:1px; background:rgba(255,255,255,0.3)"
          ></div>
        </div>

        <!-- Resize handles -->
        <div
          class="absolute bg-white border border-surface-400 rounded-sm cursor-nw-resize"
          style="top:-${handleSize / 2}px; left:-${handleSize /
          2}px; width:${handleSize}px; height:${handleSize}px;"
          @mousedown=${(e: MouseEvent) => this.startCropDrag(e, 'nw')}
        ></div>
        <div
          class="absolute bg-white border border-surface-400 rounded-sm cursor-ne-resize"
          style="top:-${handleSize / 2}px; right:-${handleSize /
          2}px; width:${handleSize}px; height:${handleSize}px;"
          @mousedown=${(e: MouseEvent) => this.startCropDrag(e, 'ne')}
        ></div>
        <div
          class="absolute bg-white border border-surface-400 rounded-sm cursor-sw-resize"
          style="bottom:-${handleSize / 2}px; left:-${handleSize /
          2}px; width:${handleSize}px; height:${handleSize}px;"
          @mousedown=${(e: MouseEvent) => this.startCropDrag(e, 'sw')}
        ></div>
        <div
          class="absolute bg-white border border-surface-400 rounded-sm cursor-se-resize"
          style="bottom:-${handleSize / 2}px; right:-${handleSize /
          2}px; width:${handleSize}px; height:${handleSize}px;"
          @mousedown=${(e: MouseEvent) => this.startCropDrag(e, 'se')}
        ></div>
      </div>
    `;
  }
}
