import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  DEFAULT_APP_LANGUAGE,
  DEFAULT_NAVIGATOR_CONFIG,
  SUPPORTED_APP_LANGUAGES,
  type AppLanguage,
  type CreateNavigatorConfigData,
  type Museum,
} from '@artaround/shared';
import { navigatorConfigService } from '../../services/navigator-config.service';
import { museumService } from '../../services/museum.service';
import { aiService } from '../../services/ai.service';
import {
  HEX_COLOR_REGEX,
  SLUG_REGEX,
  sanitizeSlug,
  updateNavigatorConfigTranslationField,
  getNavigatorImageEditorDefinitions,
  renderNavigatorImageEditors,
  renderNavigatorColorField,
  renderNavigatorTranslationsSection,
  computeNavigatorMissingTranslations,
  getNavigatorConfigTourSlides,
  NAVIGATOR_FONT_SELECT_OPTIONS,
  type NavigatorConfigFormData,
  type NavigatorColorFieldKey,
  type NavigatorTranslationFieldKey,
  type NavigatorImageFieldKey,
} from '../../utils/navigator-config';
import { cleanTranslationMap, normalizeTranslationMap } from '../../utils/translation-fields';
import { getAppLanguageLabel } from '../../utils/language-label';
import '../ui/ui-page-header';
import '../ui/ui-card';
import '../ui/ui-button';
import '../ui/ui-input';
import '../ui/ui-textarea';
import '../ui/ui-select';
import '../ui/ui-alert';
import '../ui/ui-loading';
import '../ui/ui-badge';
import '../ui/ui-color-input';
import '../ui/ui-info-tip';
import '../ui/ui-tour';
import '../ui/image-editor';
import { __ } from '../../services/i18n.service';

type NavigatorTextFieldKey = 'startUrl' | 'scope';
type NavigatorGeneralFieldKey = 'name' | 'slug' | 'homeTitle' | 'manifestName' | 'shortName';

/**
 * Editor della configurazione Navigator globale (applicability 'global').
 */
@customElement('navigator-default-config-page')
export class NavigatorDefaultConfigPage extends LitElement {
  private readonly navigatorImageEditors = getNavigatorImageEditorDefinitions();
  private readonly tourSlides = getNavigatorConfigTourSlides();

  // Mostrato ad ogni visita di questa pagina (nessuna persistenza).
  @state() private showTour = true;

  @state() private config: NavigatorConfigFormData | null = null;
  @state() private museums: Museum[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private checkingAI = false;
  @state() private translatingNavigatorConfig = false;
  @state() private error = '';
  @state() private success = '';
  @state() private translationLanguage: AppLanguage | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.loadConfig();
    museumService.getMuseums().then((museums) => (this.museums = museums));
  }

  // Nessuna config globale salvata: parte precompilata con l'estetica attuale del Navigator.
  private getEmptyConfig(): NavigatorConfigFormData {
    const d = DEFAULT_NAVIGATOR_CONFIG;
    return {
      id: '',
      name: d.name,
      slug: d.slug,
      applicability: 'global',
      museumId: '',
      logo: d.branding.logo || '',
      splashImage: d.branding.splashImage || '',
      primaryColor: d.branding.primaryColor,
      secondaryColor: d.branding.secondaryColor || '',
      appBackgroundColor: d.branding.backgroundColor || '',
      displayFont: d.branding.displayFont || '',
      bodyFont: d.branding.bodyFont || '',
      homeTitle: d.content?.homeTitle || '',
      homeTitleTranslations: {},
      welcomeText: d.content?.welcomeText || '',
      welcomeTextTranslations: {},
      openingImage: d.content?.openingImage || '',
      featuredMuseumId: d.content?.featuredMuseumId || '',
      manifestName: d.pwa.manifestName,
      shortName: d.pwa.shortName,
      manifestDescription: d.pwa.description || '',
      manifestDescriptionTranslations: {},
      themeColor: d.pwa.themeColor,
      backgroundColor: d.pwa.backgroundColor,
      display: d.pwa.display,
      orientation: d.pwa.orientation,
      startUrl: d.pwa.startUrl,
      scope: d.pwa.scope,
      icon192: d.pwa.icon192 || '',
      icon512: d.pwa.icon512 || '',
      iconMaskable: d.pwa.iconMaskable || '',
      appleTouchIcon: d.pwa.appleTouchIcon || '',
    };
  }

  private async loadConfig() {
    this.error = '';
    this.loading = true;
    const configs = await navigatorConfigService.list();
    const global = configs.find((c) => c.applicability === 'global');

    this.config = global
      ? {
          id: global._id,
          name: global.name,
          slug: global.slug,
          applicability: 'global',
          museumId: '',
          logo: global.branding.logo || '',
          splashImage: global.branding.splashImage || '',
          primaryColor: global.branding.primaryColor,
          secondaryColor: global.branding.secondaryColor || '',
          appBackgroundColor: global.branding.backgroundColor || '',
          displayFont: global.branding.displayFont || '',
          bodyFont: global.branding.bodyFont || '',
          homeTitle: global.content?.homeTitle || '',
          homeTitleTranslations: normalizeTranslationMap(global.content?.homeTitleTranslations),
          welcomeText: global.content?.welcomeText || '',
          welcomeTextTranslations: normalizeTranslationMap(global.content?.welcomeTextTranslations),
          openingImage: global.content?.openingImage || '',
          featuredMuseumId: global.content?.featuredMuseumId || '',
          manifestName: global.pwa.manifestName,
          shortName: global.pwa.shortName,
          manifestDescription: global.pwa.description || '',
          manifestDescriptionTranslations: normalizeTranslationMap(
            global.pwa.descriptionTranslations,
          ),
          themeColor: global.pwa.themeColor,
          backgroundColor: global.pwa.backgroundColor,
          display: global.pwa.display,
          orientation: global.pwa.orientation,
          startUrl: global.pwa.startUrl,
          scope: global.pwa.scope,
          icon192: global.pwa.icon192 || '',
          icon512: global.pwa.icon512 || '',
          iconMaskable: global.pwa.iconMaskable || '',
          appleTouchIcon: global.pwa.appleTouchIcon || '',
        }
      : this.getEmptyConfig();

    this.loading = false;
  }

  private updateConfig(patch: Partial<NavigatorConfigFormData>) {
    if (!this.config) return;
    this.config = { ...this.config, ...patch };
  }

  private getSourceLanguage(): AppLanguage {
    return DEFAULT_APP_LANGUAGE;
  }

  private getTargetLanguages(): AppLanguage[] {
    return [...SUPPORTED_APP_LANGUAGES].filter((lang) => lang !== this.getSourceLanguage());
  }

  private cleanTranslations(
    value: Partial<Record<AppLanguage, string>>,
  ): Partial<Record<AppLanguage, string>> | undefined {
    return cleanTranslationMap(value, this.getSourceLanguage(), this.getTargetLanguages());
  }

  private updateTranslationField(
    fieldKey: NavigatorTranslationFieldKey,
    language: AppLanguage,
    value: string,
  ) {
    if (!this.config) return;
    const [updated] = updateNavigatorConfigTranslationField(
      [this.config],
      this.config.id,
      fieldKey,
      language,
      value,
    );
    this.config = updated;
  }

  private async translateMissingNavigatorFields() {
    const config = this.config;
    if (!config) return;

    const sourceLanguage = this.getSourceLanguage();
    const targets = this.getTargetLanguages();

    if (targets.length === 0) {
      this.error = __('Seleziona almeno una lingua aggiuntiva per tradurre il navigator');
      return;
    }

    this.translatingNavigatorConfig = true;
    this.error = '';

    try {
      const patch = await computeNavigatorMissingTranslations(config, sourceLanguage, targets);
      if (!patch) {
        this.success = __('Le traduzioni navigator sono già complete');
        return;
      }

      this.config = { ...config, ...patch };
      this.success = __('Traduzioni navigator generate con successo');
    } catch {
      this.error = __('Traduzione automatica non riuscita');
    } finally {
      this.translatingNavigatorConfig = false;
    }
  }

  private renderTranslations(config: NavigatorConfigFormData) {
    const targetLanguages = this.getTargetLanguages();

    return renderNavigatorTranslationsSection({
      config,
      sourceLanguageLabel: getAppLanguageLabel(this.getSourceLanguage()),
      targetLanguages,
      selectedLanguage: this.translationLanguage || targetLanguages[0] || null,
      getLanguageLabel: (lang) => getAppLanguageLabel(lang),
      onSelectLanguage: (lang) => {
        this.translationLanguage = lang;
      },
      onUpdateField: (field, lang, value) => this.updateTranslationField(field, lang, value),
      emptyTargetsMessage: __('Non ci sono altre lingue disponibili da tradurre.'),
      translateMissing: {
        label: __('Traduci campi navigator mancanti con AI'),
        loading: this.translatingNavigatorConfig,
        disabled: targetLanguages.length === 0,
        onClick: () => this.translateMissingNavigatorFields(),
      },
    });
  }

  private updateNavigatorImageField(key: NavigatorImageFieldKey, path: string | undefined) {
    this.updateConfig({ [key]: path || '' } as Partial<NavigatorConfigFormData>);
  }

  private renderNavigatorImageEditors(config: NavigatorConfigFormData) {
    return renderNavigatorImageEditors(config, this.navigatorImageEditors, (key, path) =>
      this.updateNavigatorImageField(key, path),
    );
  }

  private renderColorField(
    fieldKey: NavigatorColorFieldKey,
    label: string,
    fallback: string,
    help = '',
  ) {
    if (!this.config) return nothing;
    return renderNavigatorColorField(
      this.config,
      fieldKey,
      label,
      fallback,
      (patch) => this.updateConfig(patch),
      help,
    );
  }

  private renderTextField(fieldKey: NavigatorTextFieldKey, label: string, help = '') {
    if (!this.config) return nothing;
    const config = this.config;
    return html`
      <ui-input
        label=${label}
        .help=${help}
        .value=${config[fieldKey]}
        @input-change=${(e: CustomEvent) =>
          this.updateConfig({ [fieldKey]: e.detail.value } as Partial<NavigatorConfigFormData>)}
      ></ui-input>
    `;
  }

  private renderGeneralField(
    fieldKey: NavigatorGeneralFieldKey,
    label: string,
    options: { required?: boolean; transform?: (value: string) => string; help?: string } = {},
  ) {
    if (!this.config) return nothing;
    const config = this.config;
    const { required = false, transform, help = '' } = options;
    return html`
      <ui-input
        label=${label}
        .help=${help}
        .value=${config[fieldKey]}
        @input-change=${(e: CustomEvent) =>
          this.updateConfig({
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
    return html`<ui-alert
      variant=${variant}
      message=${message}
      dismissible
      @dismiss=${onDismiss}
    ></ui-alert>`;
  }

  private validateBeforeSave(): string | null {
    if (!this.config) return __('La configurazione non è ancora caricata');
    const config = this.config;

    if (!config.name.trim()) return __('Il nome è obbligatorio');

    const slug = sanitizeSlug(config.slug);
    if (!slug || !SLUG_REGEX.test(slug)) return __('Slug non valido');

    if (!config.manifestName.trim() || !config.shortName.trim()) {
      return __('Nome manifest e nome breve manifest sono obbligatori');
    }

    const colors = [
      config.primaryColor,
      config.themeColor,
      config.backgroundColor,
      config.secondaryColor,
      config.appBackgroundColor,
    ].filter(Boolean);
    for (const color of colors) {
      if (!HEX_COLOR_REGEX.test(color.trim())) {
        return `${__('Colore non valido')}. ${__('Usa formato HEX (es. #0ea5e9)')}`;
      }
    }

    return null;
  }

  private toPayload(): CreateNavigatorConfigData {
    const config = this.config!;
    return {
      name: config.name,
      slug: sanitizeSlug(config.slug),
      applicability: 'global',
      branding: {
        logo: config.logo || undefined,
        splashImage: config.splashImage || undefined,
        primaryColor: config.primaryColor,
        secondaryColor: config.secondaryColor || undefined,
        backgroundColor: config.appBackgroundColor || undefined,
        displayFont: (config.displayFont ||
          undefined) as CreateNavigatorConfigData['branding']['displayFont'],
        bodyFont: (config.bodyFont ||
          undefined) as CreateNavigatorConfigData['branding']['bodyFont'],
      },
      content: {
        homeTitle: config.homeTitle || undefined,
        homeTitleTranslations: this.cleanTranslations(config.homeTitleTranslations),
        welcomeText: config.welcomeText || undefined,
        welcomeTextTranslations: this.cleanTranslations(config.welcomeTextTranslations),
        openingImage: config.openingImage || undefined,
        featuredMuseumId: config.featuredMuseumId || undefined,
      },
      pwa: {
        manifestName: config.manifestName,
        shortName: config.shortName,
        description: config.manifestDescription || undefined,
        descriptionTranslations: this.cleanTranslations(config.manifestDescriptionTranslations),
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
    };
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
    const payload = this.toPayload();
    const result = this.config!.id
      ? await navigatorConfigService.update(this.config!.id, payload)
      : await navigatorConfigService.create(payload);

    if (result.error || !result.data) {
      this.error = result.error || __('Errore durante il salvataggio');
    } else {
      this.success = __('Configurazione globale salvata con successo');
      await this.loadConfig();
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

  private openManifestPreview() {
    if (!this.config?.slug) return;
    window.open(
      `/api/navigator-configs/manifest?slug=${encodeURIComponent(this.config.slug)}`,
      '_blank',
    );
  }

  // Apre l'app Navigator vera con questa config attiva (?ncfg=slug) — non solo l'anteprima manifest.
  private openNavigatorPreview() {
    if (!this.config?.slug) return;
    window.open(`/navigator/?ncfg=${encodeURIComponent(this.config.slug)}`, '_blank');
  }

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

    const config = this.config;

    return html`
      <div class="space-y-6 animate-fade-in">
        ${this.renderFeedbackAlert('error', this.error, () => (this.error = ''))}
        ${this.renderFeedbackAlert('success', this.success, () => (this.success = ''))}

        <ui-page-header
          .title=${__('Configurazione globale Navigator')}
          .description=${__(
            "L'unica configurazione valida per tutti i musei che non hanno una propria configurazione dedicata",
          )}
          .help=${__(
            'Se un museo ha una propria Configurazione Navigator (sezione "Configurazioni Navigator" in Gestione Musei), quella ha sempre la precedenza su questa. Modifica qui solo il branding/manifest usato di default.',
          )}
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
        ${!this.loading && config
          ? html`
              <ui-card padding="none">
                <div class="p-6 space-y-5">
                  <div class="flex items-center justify-end gap-2">
                    <ui-button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon="download"
                      .label=${__('Anteprima manifest')}
                      ?disabled=${!config.id}
                      @click=${this.openManifestPreview}
                    ></ui-button>
                    <ui-button
                      type="button"
                      variant="secondary"
                      size="sm"
                      icon="link"
                      .label=${__('Apri Navigator')}
                      ?disabled=${!config.id}
                      @click=${() => this.openNavigatorPreview()}
                    ></ui-button>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    ${this.renderGeneralField('name', __('Nome Config *'), {
                      required: true,
                      help: __(
                        "Solo per riconoscerla qui nell'elenco delle configurazioni — non è mai visibile ai visitatori del Navigator.",
                      ),
                    })}
                    ${this.renderGeneralField('slug', __('Slug *'), {
                      help: __(
                        'Identificatore univoco nel link/QR di questa configurazione (?ncfg=slug). Cambiarlo dopo la pubblicazione invalida i link e i QR già distribuiti.',
                      ),
                      required: true,
                      transform: sanitizeSlug,
                    })}
                    ${this.renderGeneralField('homeTitle', __('Titolo Home'), {
                      help: __(
                        'Titolo mostrato nella schermata Home del Navigator, sotto il logo.',
                      ),
                    })}
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ui-select
                      .label=${__('Museo in evidenza')}
                      .help=${__(
                        'Il museo mostrato in primo piano nella Home del Navigator quando questa configurazione permette di scegliere tra più musei.',
                      )}
                      .value=${config.featuredMuseumId}
                      .options=${this.museums.map((m) => ({ value: m._id, label: m.name }))}
                      placeholder=${__('Il primo della lista (default)')}
                      @select-change=${(e: CustomEvent) =>
                        this.updateConfig({ featuredMuseumId: e.detail.value })}
                    ></ui-select>
                    ${this.renderGeneralField('manifestName', __('Nome manifest *'), {
                      required: true,
                      help: __(
                        "Nome completo dell'app mostrato durante l'installazione e nel selettore app del telefono.",
                      ),
                    })}
                    ${this.renderGeneralField('shortName', __('Nome breve manifest *'), {
                      required: true,
                      help: __(
                        "Nome mostrato sotto l'icona nella schermata Home — tienilo breve, gli schermi tagliano i nomi troppo lunghi.",
                      ),
                    })}
                    ${this.renderColorField(
                      'primaryColor',
                      __('Colore primario'),
                      '#0ea5e9',
                      __(
                        'Accento principale di tutta la UI del Navigator: pulsanti, gradiente, elementi in evidenza.',
                      ),
                    )}
                    ${this.renderColorField(
                      'secondaryColor',
                      __('Colore secondario'),
                      '#1f2937',
                      __(
                        "Estremità opposta del gradiente firma dell'app, insieme al colore primario.",
                      ),
                    )}
                    ${this.renderColorField(
                      'appBackgroundColor',
                      __('Colore sfondo app'),
                      '#0b0813',
                      __(
                        'Sfondo di tutte le schermate del Navigator: da questo colore vengono derivate automaticamente le sue sfumature (card, bordi, testo).',
                      ),
                    )}
                    ${this.renderColorField(
                      'themeColor',
                      __('Colore tema (barra browser)'),
                      '#0ea5e9',
                      __(
                        "Colore della barra di stato/indirizzo del browser e della splash screen quando l'app è installata sul telefono — non incide sull'aspetto interno del Navigator.",
                      ),
                    )}
                    ${this.renderColorField(
                      'backgroundColor',
                      __('Colore sfondo manifest/splash'),
                      '#ffffff',
                      __(
                        "Sfondo mostrato per una frazione di secondo all'avvio dell'app installata, prima che venga caricata la vera schermata — impostalo simile al colore sfondo app per evitare un lampo di colore diverso.",
                      ),
                    )}
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ui-select
                      .label=${__('Font titoli')}
                      .help=${__('Font usato per titoli e intestazioni nel Navigator.')}
                      .value=${config.displayFont}
                      .options=${NAVIGATOR_FONT_SELECT_OPTIONS}
                      placeholder=${__('Predefinito')}
                      @select-change=${(e: CustomEvent) =>
                        this.updateConfig({ displayFont: e.detail.value })}
                    ></ui-select>
                    <ui-select
                      .label=${__('Font testo')}
                      .help=${__('Font usato per il corpo dei testi (descrizioni, paragrafi).')}
                      .value=${config.bodyFont}
                      .options=${NAVIGATOR_FONT_SELECT_OPTIONS}
                      placeholder=${__('Predefinito')}
                      @select-change=${(e: CustomEvent) =>
                        this.updateConfig({ bodyFont: e.detail.value })}
                    ></ui-select>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ui-select
                      .label=${__('Visualizzazione')}
                      .help=${__(
                        "Come appare l'app una volta installata sul telefono: standalone nasconde la UI del browser mantenendo la barra di stato, fullscreen nasconde anche quella, minimal-ui lascia pochi controlli di navigazione, browser la apre come una normale scheda.",
                      )}
                      .value=${config.display}
                      .options=${displayOptions}
                      @select-change=${(e: CustomEvent) =>
                        this.updateConfig({
                          display: e.detail.value as NavigatorConfigFormData['display'],
                        })}
                    ></ui-select>
                    <ui-select
                      .label=${__('Orientamento')}
                      .help=${__(
                        'Blocca l\'app installata su un orientamento (verticale/orizzontale) oppure segue quello del dispositivo ("any").',
                      )}
                      .value=${config.orientation}
                      .options=${orientationOptions}
                      @select-change=${(e: CustomEvent) =>
                        this.updateConfig({
                          orientation: e.detail.value as NavigatorConfigFormData['orientation'],
                        })}
                    ></ui-select>
                    ${this.renderTextField(
                      'startUrl',
                      __('URL iniziale'),
                      __(
                        'Pagina aperta quando si avvia l\'app installata dall\'icona in home screen. Di norma "/" (la Home del Navigator).',
                      ),
                    )}
                    ${this.renderTextField(
                      'scope',
                      __('Ambito'),
                      __(
                        'Percorso entro cui l\'app resta "installata": uscendo da questo ambito, i link si aprono nel browser normale invece che nell\'app.',
                      ),
                    )}
                  </div>

                  <ui-textarea
                    .label=${__('Testo di benvenuto')}
                    .help=${__(
                      'Testo mostrato nella schermata di benvenuto, prima che il visitatore entri nel Navigator — se vuoto, quella schermata non compare affatto.',
                    )}
                    .value=${config.welcomeText}
                    @textarea-change=${(e: CustomEvent) =>
                      this.updateConfig({ welcomeText: e.detail.value })}
                    rows="3"
                  ></ui-textarea>

                  <ui-textarea
                    .label=${__('Descrizione manifest')}
                    .help=${__(
                      "Descrizione tecnica dell'app usata dal sistema operativo (es. nella schermata di conferma installazione) — non compare mai dentro il Navigator stesso.",
                    )}
                    .value=${config.manifestDescription}
                    @textarea-change=${(e: CustomEvent) =>
                      this.updateConfig({ manifestDescription: e.detail.value })}
                    rows="2"
                  ></ui-textarea>

                  ${this.renderTranslations(config)}

                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    ${this.renderNavigatorImageEditors(config)}
                  </div>
                </div>
              </ui-card>
            `
          : nothing}
      </div>

      ${this.showTour
        ? html`
            <ui-tour
              .slides=${this.tourSlides}
              @tour-finished=${() => (this.showTour = false)}
            ></ui-tour>
          `
        : nothing}
    `;
  }
}
