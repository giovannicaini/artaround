import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { NavigatorAppConfig } from '@artaround/shared';
import { navigatorDefaultConfigService } from '../../services/navigator-default-config.service';
import { aiService } from '../../services/ai.service';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-textarea';
import '../ui/ui-select';
import '../ui/ui-alert';
import '../ui/ui-loading';
import { __ } from '../../services/i18n.service';

interface NavigatorConfigFormData {
  id: string;
  name: string;
  slug: string;
  logo: string;
  splashImage: string;
  primaryColor: string;
  secondaryColor: string;
  homeTitle: string;
  homeSubtitle: string;
  welcomeText: string;
  openingImage: string;
  manifestName: string;
  shortName: string;
  manifestDescription: string;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'any' | 'natural' | 'landscape' | 'portrait';
  startUrl: string;
  scope: string;
  icon192: string;
  icon512: string;
  iconMaskable: string;
  appleTouchIcon: string;
}

type NavigatorColorFieldKey = 'primaryColor' | 'secondaryColor' | 'themeColor' | 'backgroundColor';
type NavigatorTextFieldKey =
  | 'logo'
  | 'splashImage'
  | 'openingImage'
  | 'icon192'
  | 'icon512'
  | 'iconMaskable'
  | 'appleTouchIcon'
  | 'startUrl'
  | 'scope';
type NavigatorGeneralFieldKey =
  | 'name'
  | 'slug'
  | 'homeTitle'
  | 'homeSubtitle'
  | 'manifestName'
  | 'shortName';

@customElement('navigator-default-config-page')
export class NavigatorDefaultConfigPage extends LitElement {
  private static readonly HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  @state() private configs: NavigatorConfigFormData[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private checkingAI = false;
  @state() private error = '';
  @state() private success = '';

  // ─── Lifecycle ───────────────────────────────────────────
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadConfigs();
  }

  // ─── Data Loading & State ────────────────────────────────
  private getEmptyConfig(index: number): NavigatorConfigFormData {
    return {
      id: `default-cfg-${Date.now()}-${index}`,
      name: `Default Navigator ${index}`,
      slug: `default-navigator-${index}`,
      logo: '',
      splashImage: '',
      primaryColor: '#0ea5e9',
      secondaryColor: '#1f2937',
      homeTitle: '',
      homeSubtitle: '',
      welcomeText: '',
      openingImage: '',
      manifestName: `ArtAround Navigator Default ${index}`,
      shortName: `AANav D${index}`,
      manifestDescription: '',
      themeColor: '#0ea5e9',
      backgroundColor: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      startUrl: '/',
      scope: '/',
      icon192: '',
      icon512: '',
      iconMaskable: '',
      appleTouchIcon: '',
    };
  }

  private async loadConfigs() {
    this.error = '';
    this.loading = true;
    const result = await navigatorDefaultConfigService.getConfigs();
    if (result.error) {
      this.error = result.error;
      this.configs = [this.getEmptyConfig(1)];
      this.loading = false;
      return;
    }

    const raw = result.data || [];
    if (raw.length === 0) {
      this.configs = [this.getEmptyConfig(1)];
      this.loading = false;
      return;
    }

    this.configs = raw.slice(0, 1).map((config) => ({
      id: config.id,
      name: config.name,
      slug: config.slug,
      logo: config.branding.logo || '',
      splashImage: config.branding.splashImage || '',
      primaryColor: config.branding.primaryColor,
      secondaryColor: config.branding.secondaryColor || '',
      homeTitle: config.content?.homeTitle || '',
      homeSubtitle: config.content?.homeSubtitle || '',
      welcomeText: config.content?.welcomeText || '',
      openingImage: config.content?.openingImage || '',
      manifestName: config.pwa.manifestName,
      shortName: config.pwa.shortName,
      manifestDescription: config.pwa.description || '',
      themeColor: config.pwa.themeColor,
      backgroundColor: config.pwa.backgroundColor,
      display: config.pwa.display,
      orientation: config.pwa.orientation,
      startUrl: config.pwa.startUrl,
      scope: config.pwa.scope,
      icon192: config.pwa.icon192 || '',
      icon512: config.pwa.icon512 || '',
      iconMaskable: config.pwa.iconMaskable || '',
      appleTouchIcon: config.pwa.appleTouchIcon || '',
    }));
    this.loading = false;
  }

  private updateConfig(id: string, patch: Partial<NavigatorConfigFormData>) {
    this.configs = this.configs.map((config) =>
      config.id === id
        ? {
            ...config,
            ...patch,
          }
        : config,
    );
  }

  private sanitizeSlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private normalizeHexColor(value: string, fallback = '#000000'): string {
    const normalized = value.trim();
    if (NavigatorDefaultConfigPage.HEX_COLOR_REGEX.test(normalized)) {
      return normalized;
    }
    return fallback;
  }

  // ─── Render Helpers ──────────────────────────────────────
  private renderColorField(
    config: NavigatorConfigFormData,
    fieldKey: NavigatorColorFieldKey,
    label: string,
    fallback: string,
  ) {
    return html`
      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
          ${label}
        </label>
        <div class="flex items-center gap-2">
          <input
            type="color"
            class="h-10 w-14 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1"
            .value=${this.normalizeHexColor(config[fieldKey], fallback)}
            @input=${(e: Event) =>
              this.updateConfig(config.id, {
                [fieldKey]: (e.target as HTMLInputElement).value,
              } as Partial<NavigatorConfigFormData>)}
          />
          <div class="flex-1">
            <ui-input
              .value=${config[fieldKey]}
              @input-change=${(e: CustomEvent) =>
                this.updateConfig(config.id, {
                  [fieldKey]: e.detail.value,
                } as Partial<NavigatorConfigFormData>)}
            ></ui-input>
          </div>
        </div>
      </div>
    `;
  }

  private renderTextField(
    config: NavigatorConfigFormData,
    fieldKey: NavigatorTextFieldKey,
    label: string,
    fallback = '',
  ) {
    return html`
      <ui-input
        label=${label}
        .value=${config[fieldKey]}
        @input-change=${(e: CustomEvent) =>
          this.updateConfig(config.id, {
            [fieldKey]: e.detail.value || fallback,
          } as Partial<NavigatorConfigFormData>)}
      ></ui-input>
    `;
  }

  private renderGeneralField(
    config: NavigatorConfigFormData,
    fieldKey: NavigatorGeneralFieldKey,
    label: string,
    options: {
      required?: boolean;
      transform?: (value: string) => string;
    } = {},
  ) {
    const { required = false, transform } = options;

    return html`
      <ui-input
        label=${label}
        .value=${config[fieldKey]}
        @input-change=${(e: CustomEvent) =>
          this.updateConfig(config.id, {
            [fieldKey]: transform ? transform(e.detail.value) : e.detail.value,
          } as Partial<NavigatorConfigFormData>)}
        ?required=${required}
      ></ui-input>
    `;
  }

  private renderFeedbackAlert(
    variant: 'error' | 'success',
    message: string,
    onDismiss: () => void,
  ) {
    if (!message) return nothing;

    return html`
      <ui-alert variant=${variant} message=${message} dismissible @dismiss=${onDismiss}></ui-alert>
    `;
  }

  // ─── Validation & Save ───────────────────────────────────
  private validateBeforeSave(): string | null {
    if (!this.configs.length) {
      return __('La configurazione default è obbligatoria');
    }

    const slugSet = new Set<string>();

    for (const config of this.configs) {
      if (!config.id.trim() || !config.name.trim()) {
        return __('Ogni configurazione deve avere ID e nome');
      }

      const slug = this.sanitizeSlug(config.slug);
      if (!slug || !NavigatorDefaultConfigPage.SLUG_REGEX.test(slug)) {
        return `${__('Slug non valido per')} "${config.name}"`;
      }

      if (slugSet.has(slug)) {
        return `Slug duplicato: ${slug}`;
      }
      slugSet.add(slug);

      if (!config.manifestName.trim() || !config.shortName.trim()) {
        return `Manifest name e short name sono obbligatori per "${config.name}"`;
      }

      if (!config.startUrl.trim() || !config.scope.trim()) {
        return `Start URL e scope sono obbligatori per "${config.name}"`;
      }

      if (!config.icon192.trim() || !config.icon512.trim()) {
        return `Le icone 192x192 e 512x512 sono obbligatorie per "${config.name}"`;
      }

      const colors = [
        config.primaryColor,
        config.themeColor,
        config.backgroundColor,
        config.secondaryColor,
      ].filter(Boolean);

      for (const color of colors) {
        if (!NavigatorDefaultConfigPage.HEX_COLOR_REGEX.test(color.trim())) {
          return `Colore non valido in "${config.name}". Usa formato HEX (es. #0ea5e9)`;
        }
      }
    }

    return null;
  }

  private toPayload(): NavigatorAppConfig[] {
    return this.configs.map((config) => ({
      id: config.id,
      name: config.name,
      slug: this.sanitizeSlug(config.slug),
      branding: {
        logo: config.logo || undefined,
        splashImage: config.splashImage || undefined,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor || undefined,
      },
      content: {
        homeTitle: config.homeTitle || undefined,
        homeSubtitle: config.homeSubtitle || undefined,
        welcomeText: config.welcomeText || undefined,
        openingImage: config.openingImage || undefined,
      },
      pwa: {
        manifestName: config.manifestName,
        shortName: config.shortName,
        description: config.manifestDescription || undefined,
        themeColor: config.themeColor,
        backgroundColor: config.backgroundColor,
        display: config.display,
        orientation: config.orientation,
        startUrl: config.startUrl,
        scope: config.scope,
        icon192: config.icon192 || undefined,
        icon512: config.icon512 || undefined,
        iconMaskable: config.iconMaskable || undefined,
        appleTouchIcon: config.appleTouchIcon || undefined,
      },
    }));
  }

  private async save() {
    this.error = '';
    this.success = '';
    const validationError = this.validateBeforeSave();
    if (validationError) {
      this.error = validationError;
      return;
    }

    this.saving = true;
    const result = await navigatorDefaultConfigService.saveConfigs(this.toPayload());
    if (result.error) {
      this.error = result.error;
    } else {
      this.success = __('Configurazioni default salvate con successo');
      this.configs = (result.data || []).map((config) => ({
        id: config.id,
        name: config.name,
        slug: config.slug,
        logo: config.branding.logo || '',
        splashImage: config.branding.splashImage || '',
        primaryColor: config.branding.primaryColor,
        secondaryColor: config.branding.secondaryColor || '',
        homeTitle: config.content?.homeTitle || '',
        homeSubtitle: config.content?.homeSubtitle || '',
        welcomeText: config.content?.welcomeText || '',
        openingImage: config.content?.openingImage || '',
        manifestName: config.pwa.manifestName,
        shortName: config.pwa.shortName,
        manifestDescription: config.pwa.description || '',
        themeColor: config.pwa.themeColor,
        backgroundColor: config.pwa.backgroundColor,
        display: config.pwa.display,
        orientation: config.pwa.orientation,
        startUrl: config.pwa.startUrl,
        scope: config.pwa.scope,
        icon192: config.pwa.icon192 || '',
        icon512: config.pwa.icon512 || '',
        iconMaskable: config.pwa.iconMaskable || '',
        appleTouchIcon: config.pwa.appleTouchIcon || '',
      }));
    }
    this.saving = false;
  }

  private async testOpenAI() {
    this.error = '';
    this.success = '';
    this.checkingAI = true;

    try {
      const result = await aiService.checkHealth();
      if (result.data?.ok) {
        this.success = `OpenAI connessa correttamente (model: ${result.data.model})`;
      } else {
        this.error =
          result.error || result.data?.error || 'OpenAI non configurata o non raggiungibile';
      }
    } finally {
      this.checkingAI = false;
    }
  }

  private exportManifest(config: NavigatorConfigFormData) {
    const validationError = this.validateBeforeSave();
    if (validationError) {
      this.error = validationError;
      return;
    }

    const manifest = {
      name: config.manifestName,
      short_name: config.shortName,
      description: config.manifestDescription || undefined,
      start_url: config.startUrl,
      scope: config.scope,
      display: config.display,
      orientation: config.orientation,
      theme_color: config.themeColor,
      background_color: config.backgroundColor,
      icons: [
        config.icon192 ? { src: config.icon192, sizes: '192x192', type: 'image/png' } : null,
        config.icon512 ? { src: config.icon512, sizes: '512x512', type: 'image/png' } : null,
        config.iconMaskable
          ? {
              src: config.iconMaskable,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            }
          : null,
        config.appleTouchIcon
          ? { src: config.appleTouchIcon, sizes: '180x180', type: 'image/png' }
          : null,
      ].filter(Boolean),
    };

    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: 'application/manifest+json',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = `${config.slug || 'navigator-default'}-manifest.webmanifest`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  // ─── Render Entry ────────────────────────────────────────
  render() {
    const displayOptions = [
      { value: 'standalone', label: __('Standalone') },
      { value: 'fullscreen', label: __('Fullscreen') },
      { value: 'minimal-ui', label: __('Minimal UI') },
      { value: 'browser', label: __('Browser') },
    ];

    const orientationOptions = [
      { value: 'portrait', label: __('Portrait') },
      { value: 'landscape', label: __('Landscape') },
      { value: 'natural', label: __('Natural') },
      { value: 'any', label: __('Any') },
    ];

    return html`
      <div class="space-y-6 animate-fade-in">
        ${this.renderFeedbackAlert('error', this.error, () => (this.error = ''))}
        ${this.renderFeedbackAlert('success', this.success, () => (this.success = ''))}

        <ui-page-header
          .title=${__('Configurazione default app navigator')}
          .description=${__("Definisci la configurazione globale di default per l'app navigator")}
        >
          <div slot="actions">
            <ui-button
              variant="secondary"
              icon="sparkles"
              .label=${__('Test OpenAI')}
              .loading=${this.checkingAI}
              @click=${this.testOpenAI}
            ></ui-button>
            <ui-button
              variant="primary"
              icon="check"
              .label=${__('Salva')}
              .loading=${this.saving}
              @click=${this.save}
            ></ui-button>
          </div>
        </ui-page-header>
        ${this.loading ? html`<ui-loading></ui-loading>` : nothing}
        ${!this.loading && this.configs.length > 0
          ? html`
              <div class="space-y-4">
                ${this.configs.map(
                  (config) => html`
                    <ui-card>
                      <div class="p-6 space-y-5">
                        <div class="flex items-center justify-end">
                          <ui-button
                            type="button"
                            variant="secondary"
                            size="sm"
                            icon="download"
                            .label=${__('Esporta manifest')}
                            @click=${() => this.exportManifest(config)}
                          ></ui-button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                          ${this.renderGeneralField(config, 'name', __('Nome Config *'), {
                            required: true,
                          })}
                          ${this.renderGeneralField(config, 'slug', __('Slug *'), {
                            required: true,
                            transform: (value) => this.sanitizeSlug(value),
                          })}
                          ${this.renderGeneralField(config, 'homeTitle', __('Titolo Home'))}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          ${this.renderGeneralField(config, 'homeSubtitle', __('Sottotitolo Home'))}
                          ${this.renderGeneralField(config, 'manifestName', __('Nome manifest *'), {
                            required: true,
                          })}
                          ${this.renderGeneralField(
                            config,
                            'shortName',
                            __('Nome breve manifest *'),
                            {
                              required: true,
                            },
                          )}
                          ${this.renderColorField(
                            config,
                            'primaryColor',
                            __('Colore primario'),
                            '#0ea5e9',
                          )}
                          ${this.renderColorField(
                            config,
                            'secondaryColor',
                            __('Colore secondario'),
                            '#1f2937',
                          )}
                          ${this.renderColorField(
                            config,
                            'themeColor',
                            __('Colore tema'),
                            '#0ea5e9',
                          )}
                          ${this.renderColorField(
                            config,
                            'backgroundColor',
                            __('Colore sfondo'),
                            '#ffffff',
                          )}
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ui-select
                            .label=${__('Visualizzazione')}
                            .value=${config.display}
                            .options=${displayOptions}
                            @select-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, {
                                display: e.detail.value as NavigatorConfigFormData['display'],
                              })}
                          ></ui-select>
                          <ui-select
                            .label=${__('Orientamento')}
                            .value=${config.orientation}
                            .options=${orientationOptions}
                            @select-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, {
                                orientation: e.detail
                                  .value as NavigatorConfigFormData['orientation'],
                              })}
                          ></ui-select>
                          ${this.renderTextField(config, 'startUrl', __('URL iniziale'), '/')}
                          ${this.renderTextField(config, 'scope', __('Ambito'), '/')}
                        </div>

                        <ui-textarea
                          .label=${__('Testo di benvenuto')}
                          .value=${config.welcomeText}
                          @textarea-change=${(e: CustomEvent) =>
                            this.updateConfig(config.id, { welcomeText: e.detail.value })}
                          rows="3"
                        ></ui-textarea>

                        <ui-textarea
                          .label=${__('Descrizione manifest')}
                          .value=${config.manifestDescription}
                          @textarea-change=${(e: CustomEvent) =>
                            this.updateConfig(config.id, {
                              manifestDescription: e.detail.value,
                            })}
                          rows="2"
                        ></ui-textarea>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          ${this.renderTextField(config, 'logo', __('URL logo'))}
                          ${this.renderTextField(config, 'splashImage', __('URL splash'))}
                          ${this.renderTextField(
                            config,
                            'openingImage',
                            __('URL immagine iniziale'),
                          )}
                          ${this.renderTextField(config, 'icon192', __('URL icona 192x192'))}
                          ${this.renderTextField(config, 'icon512', __('URL icona 512x512'))}
                          ${this.renderTextField(config, 'iconMaskable', __('URL icona maskable'))}
                          ${this.renderTextField(
                            config,
                            'appleTouchIcon',
                            __('URL icona Apple Touch'),
                          )}
                        </div>
                      </div>
                    </ui-card>
                  `,
                )}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
