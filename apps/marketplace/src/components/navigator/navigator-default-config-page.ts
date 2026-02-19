import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { NavigatorAppConfig } from '@artaround/shared';
import { navigatorDefaultConfigService } from '../../services/navigator-default-config.service';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-textarea';
import '../ui/ui-select';
import '../ui/ui-icon';
import '../ui/ui-icon-button';
import '../ui/ui-alert';
import '../ui/ui-empty';
import '../ui/ui-loading';

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

@customElement('navigator-default-config-page')
export class NavigatorDefaultConfigPage extends LitElement {
  private static readonly HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  private static readonly SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  @state() private configs: NavigatorConfigFormData[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private error = '';
  @state() private success = '';

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadConfigs();
  }

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
      this.configs = [];
      this.loading = false;
      return;
    }

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
    this.loading = false;
  }

  private addConfig() {
    const nextIndex = this.configs.length + 1;
    this.configs = [...this.configs, this.getEmptyConfig(nextIndex)];
  }

  private removeConfig(id: string) {
    this.configs = this.configs.filter((config) => config.id !== id);
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

  private validateBeforeSave(): string | null {
    if (!this.configs.length) {
      return null;
    }

    const slugSet = new Set<string>();

    for (const config of this.configs) {
      if (!config.id.trim() || !config.name.trim()) {
        return 'Ogni configurazione deve avere ID e nome';
      }

      const slug = this.sanitizeSlug(config.slug);
      if (!slug || !NavigatorDefaultConfigPage.SLUG_REGEX.test(slug)) {
        return `Slug non valido per "${config.name}"`;
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
      this.success = 'Configurazioni default salvate con successo';
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

  render() {
    const displayOptions = [
      { value: 'standalone', label: 'Standalone' },
      { value: 'fullscreen', label: 'Fullscreen' },
      { value: 'minimal-ui', label: 'Minimal UI' },
      { value: 'browser', label: 'Browser' },
    ];

    const orientationOptions = [
      { value: 'portrait', label: 'Portrait' },
      { value: 'landscape', label: 'Landscape' },
      { value: 'natural', label: 'Natural' },
      { value: 'any', label: 'Any' },
    ];

    return html`
      <div class="space-y-6 animate-fade-in">
        ${this.error
          ? html`<ui-alert
              variant="error"
              message=${this.error}
              dismissible
              @dismiss=${() => (this.error = '')}
            ></ui-alert>`
          : nothing}
        ${this.success
          ? html`<ui-alert
              variant="success"
              message=${this.success}
              dismissible
              @dismiss=${() => (this.success = '')}
            ></ui-alert>`
          : nothing}

        <ui-page-header
          title="Configurazione default app navigator"
          description="Gestisci le configurazioni globali di default per l'app navigator"
        >
          <div slot="actions" class="flex items-center gap-2">
            <ui-button
              variant="secondary"
              icon="plus"
              label="Aggiungi Config"
              @click=${this.addConfig}
            ></ui-button>
            <ui-button
              variant="primary"
              icon="check"
              label="Salva"
              .loading=${this.saving}
              @click=${this.save}
            ></ui-button>
          </div>
        </ui-page-header>
        ${this.loading ? html`<ui-loading></ui-loading>` : nothing}
        ${!this.loading && this.configs.length === 0
          ? html`<ui-empty
              title="Nessuna configurazione default"
              description="Aggiungi una configurazione per definire i default globali del navigator"
              icon="cog"
            ></ui-empty>`
          : nothing}
        ${!this.loading && this.configs.length > 0
          ? html`
              <div class="space-y-4">
                ${this.configs.map(
                  (config, index) => html`
                    <ui-card>
                      <div class="p-6 space-y-5">
                        <div class="flex items-center justify-between">
                          <h4 class="font-semibold text-surface-900 dark:text-white">
                            Configurazione ${index + 1}
                          </h4>
                          <div class="flex items-center gap-2">
                            <ui-button
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon="download"
                              label="Export Manifest"
                              @click=${() => this.exportManifest(config)}
                            ></ui-button>
                            <ui-icon-button
                              icon="trash"
                              variant="danger"
                              title="Rimuovi configurazione"
                              @click=${() => this.removeConfig(config.id)}
                            ></ui-icon-button>
                          </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <ui-input
                            label="Nome Config *"
                            .value=${config.name}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { name: e.detail.value })}
                            required
                          ></ui-input>
                          <ui-input
                            label="Slug *"
                            .value=${config.slug}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, {
                                slug: this.sanitizeSlug(e.detail.value),
                              })}
                            required
                          ></ui-input>
                          <ui-input
                            label="Titolo Home"
                            .value=${config.homeTitle}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { homeTitle: e.detail.value })}
                          ></ui-input>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ui-input
                            label="Sottotitolo Home"
                            .value=${config.homeSubtitle}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { homeSubtitle: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Manifest Name *"
                            .value=${config.manifestName}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { manifestName: e.detail.value })}
                            required
                          ></ui-input>
                          <ui-input
                            label="Manifest Short Name *"
                            .value=${config.shortName}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { shortName: e.detail.value })}
                            required
                          ></ui-input>

                          <div class="space-y-1.5">
                            <label
                              class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                            >
                              Primary Color
                            </label>
                            <div class="flex items-center gap-2">
                              <input
                                type="color"
                                class="h-10 w-14 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1"
                                .value=${this.normalizeHexColor(config.primaryColor, '#0ea5e9')}
                                @input=${(e: Event) =>
                                  this.updateConfig(config.id, {
                                    primaryColor: (e.target as HTMLInputElement).value,
                                  })}
                              />
                              <div class="flex-1">
                                <ui-input
                                  .value=${config.primaryColor}
                                  @input-change=${(e: CustomEvent) =>
                                    this.updateConfig(config.id, { primaryColor: e.detail.value })}
                                ></ui-input>
                              </div>
                            </div>
                          </div>

                          <div class="space-y-1.5">
                            <label
                              class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                            >
                              Secondary Color
                            </label>
                            <div class="flex items-center gap-2">
                              <input
                                type="color"
                                class="h-10 w-14 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1"
                                .value=${this.normalizeHexColor(config.secondaryColor, '#1f2937')}
                                @input=${(e: Event) =>
                                  this.updateConfig(config.id, {
                                    secondaryColor: (e.target as HTMLInputElement).value,
                                  })}
                              />
                              <div class="flex-1">
                                <ui-input
                                  .value=${config.secondaryColor}
                                  @input-change=${(e: CustomEvent) =>
                                    this.updateConfig(config.id, {
                                      secondaryColor: e.detail.value,
                                    })}
                                ></ui-input>
                              </div>
                            </div>
                          </div>

                          <div class="space-y-1.5">
                            <label
                              class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                            >
                              Theme Color
                            </label>
                            <div class="flex items-center gap-2">
                              <input
                                type="color"
                                class="h-10 w-14 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1"
                                .value=${this.normalizeHexColor(config.themeColor, '#0ea5e9')}
                                @input=${(e: Event) =>
                                  this.updateConfig(config.id, {
                                    themeColor: (e.target as HTMLInputElement).value,
                                  })}
                              />
                              <div class="flex-1">
                                <ui-input
                                  .value=${config.themeColor}
                                  @input-change=${(e: CustomEvent) =>
                                    this.updateConfig(config.id, { themeColor: e.detail.value })}
                                ></ui-input>
                              </div>
                            </div>
                          </div>

                          <div class="space-y-1.5">
                            <label
                              class="block text-sm font-medium text-surface-700 dark:text-surface-300"
                            >
                              Background Color
                            </label>
                            <div class="flex items-center gap-2">
                              <input
                                type="color"
                                class="h-10 w-14 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-900 p-1"
                                .value=${this.normalizeHexColor(config.backgroundColor, '#ffffff')}
                                @input=${(e: Event) =>
                                  this.updateConfig(config.id, {
                                    backgroundColor: (e.target as HTMLInputElement).value,
                                  })}
                              />
                              <div class="flex-1">
                                <ui-input
                                  .value=${config.backgroundColor}
                                  @input-change=${(e: CustomEvent) =>
                                    this.updateConfig(config.id, {
                                      backgroundColor: e.detail.value,
                                    })}
                                ></ui-input>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ui-select
                            label="Display"
                            .value=${config.display}
                            .options=${displayOptions}
                            @select-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, {
                                display: e.detail.value as NavigatorConfigFormData['display'],
                              })}
                          ></ui-select>
                          <ui-select
                            label="Orientation"
                            .value=${config.orientation}
                            .options=${orientationOptions}
                            @select-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, {
                                orientation: e.detail
                                  .value as NavigatorConfigFormData['orientation'],
                              })}
                          ></ui-select>
                          <ui-input
                            label="Start URL"
                            .value=${config.startUrl}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { startUrl: e.detail.value || '/' })}
                          ></ui-input>
                          <ui-input
                            label="Scope"
                            .value=${config.scope}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { scope: e.detail.value || '/' })}
                          ></ui-input>
                        </div>

                        <ui-textarea
                          label="Testo di benvenuto"
                          .value=${config.welcomeText}
                          @textarea-change=${(e: CustomEvent) =>
                            this.updateConfig(config.id, { welcomeText: e.detail.value })}
                          rows="3"
                        ></ui-textarea>

                        <ui-textarea
                          label="Manifest Description"
                          .value=${config.manifestDescription}
                          @textarea-change=${(e: CustomEvent) =>
                            this.updateConfig(config.id, {
                              manifestDescription: e.detail.value,
                            })}
                          rows="2"
                        ></ui-textarea>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ui-input
                            label="Logo URL"
                            .value=${config.logo}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { logo: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Splash URL"
                            .value=${config.splashImage}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { splashImage: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Opening Image URL"
                            .value=${config.openingImage}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { openingImage: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Icon 192x192 URL"
                            .value=${config.icon192}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { icon192: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Icon 512x512 URL"
                            .value=${config.icon512}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { icon512: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Icon Maskable URL"
                            .value=${config.iconMaskable}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { iconMaskable: e.detail.value })}
                          ></ui-input>
                          <ui-input
                            label="Apple Touch Icon URL"
                            .value=${config.appleTouchIcon}
                            @input-change=${(e: CustomEvent) =>
                              this.updateConfig(config.id, { appleTouchIcon: e.detail.value })}
                          ></ui-input>
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
