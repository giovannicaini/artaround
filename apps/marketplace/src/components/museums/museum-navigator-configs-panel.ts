/*
 * File: /src/components/museums/museum-navigator-configs-panel.ts                       *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  type AppLanguage,
  type NavigatorConfig,
  type CreateNavigatorConfigData,
} from '@artaround/shared';
import { navigatorConfigService } from '../../services/navigator-config.service';
import { modalService } from '../../services/modal.service';
import { cleanTranslationMap, normalizeTranslationMap } from '../../utils/translation-fields';
import { getAppLanguageLabel } from '../../utils/language-label';
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
  NAVIGATOR_FONT_SELECT_OPTIONS,
  type NavigatorConfigFormData,
  type NavigatorColorFieldKey,
  type NavigatorTranslationFieldKey,
} from '../../utils/navigator-config';
import '../ui/ui-button';
import '../ui/ui-icon-button';
import '../ui/ui-icon';
import '../ui/ui-card';
import '../ui/ui-input';
import '../ui/ui-select';
import '../ui/ui-color-input';
import '../ui/ui-textarea';
import '../ui/ui-badge';
import '../ui/ui-loading';
import '../ui/ui-empty';
import '../ui/ui-alert';
import '../ui/ui-info-tip';
import { __ } from '../../services/i18n.service';
import { renderFeedbackAlerts } from '../../utils/feedback-alerts';

const DISPLAY_OPTIONS = [
  { value: 'standalone', label: 'Standalone' },
  { value: 'fullscreen', label: 'Fullscreen' },
  { value: 'minimal-ui', label: 'Minimal UI' },
  { value: 'browser', label: 'Browser' },
];

const ORIENTATION_OPTIONS = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'landscape', label: 'Landscape' },
  { value: 'natural', label: 'Natural' },
  { value: 'any', label: 'Any' },
];

/**
 * Configurazioni Navigator di UN museo: carica/salva/elimina da sola.
 */
@customElement('museum-navigator-configs-panel')
export class MuseumNavigatorConfigsPanel extends LitElement {
  @property({ type: String }) museumId = '';
  @property({ type: String }) sourceLanguage: AppLanguage = 'it';
  @property({ type: Array }) targetLanguages: AppLanguage[] = [];

  @state() private configs: NavigatorConfigFormData[] = [];
  @state() private loading = false;
  @state() private editing: NavigatorConfigFormData | null = null;
  @state() private saving = false;
  @state() private deletingId: string | null = null;
  @state() private translating = false;
  @state() private translationLanguage: AppLanguage | null = null;
  @state() private error = '';
  @state() private success = '';

  private readonly imageEditors = getNavigatorImageEditorDefinitions();

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    void this.loadConfigs();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('museumId') && this.museumId) void this.loadConfigs();
  }

  private getEmptyConfig(): NavigatorConfigFormData {
    return {
      id: '',
      name: '',
      slug: '',
      applicability: 'museum',
      museumId: this.museumId,
      logo: '',
      splashImage: '',
      primaryColor: '#0ea5e9',
      secondaryColor: '#1f2937',
      appBackgroundColor: '',
      displayFont: '',
      bodyFont: '',
      homeTitle: '',
      homeTitleTranslations: {},
      welcomeText: '',
      welcomeTextTranslations: {},
      openingImage: '',
      featuredMuseumId: '',
      manifestName: '',
      shortName: '',
      manifestDescription: '',
      manifestDescriptionTranslations: {},
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

  private mapToFormData(config: NavigatorConfig): NavigatorConfigFormData {
    return {
      id: config._id,
      name: config.name,
      slug: config.slug,
      applicability: config.applicability,
      museumId: config.museumId || '',
      logo: config.branding.logo || '',
      splashImage: config.branding.splashImage || '',
      primaryColor: config.branding.primaryColor,
      secondaryColor: config.branding.secondaryColor || '',
      appBackgroundColor: config.branding.backgroundColor || '',
      displayFont: config.branding.displayFont || '',
      bodyFont: config.branding.bodyFont || '',
      homeTitle: config.content?.homeTitle || '',
      homeTitleTranslations: normalizeTranslationMap(config.content?.homeTitleTranslations),
      welcomeText: config.content?.welcomeText || '',
      welcomeTextTranslations: normalizeTranslationMap(config.content?.welcomeTextTranslations),
      openingImage: config.content?.openingImage || '',
      featuredMuseumId: config.content?.featuredMuseumId || '',
      manifestName: config.pwa.manifestName,
      shortName: config.pwa.shortName,
      manifestDescription: config.pwa.description || '',
      manifestDescriptionTranslations: normalizeTranslationMap(config.pwa.descriptionTranslations),
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
    };
  }

  private async loadConfigs() {
    if (!this.museumId) return;
    this.loading = true;
    try {
      const all = await navigatorConfigService.list();
      // list() è già filtrata per i curatori; per un admin include ogni
      // museo, quindi il filtro qui tiene solo quelle di QUESTO museo.
      this.configs = all
        .filter((c) => c.applicability === 'museum' && c.museumId === this.museumId)
        .map((c) => this.mapToFormData(c));
    } catch (e) {
      console.error('Error loading navigator configs:', e);
      this.error = __('Errore nel caricamento delle configurazioni navigator');
    } finally {
      this.loading = false;
    }
  }

  private openNew() {
    this.editing = this.getEmptyConfig();
    this.translationLanguage = null;
    this.error = '';
    this.success = '';
  }

  private openEdit(config: NavigatorConfigFormData) {
    this.editing = { ...config };
    this.translationLanguage = null;
    this.error = '';
    this.success = '';
  }

  private updateEditing(patch: Partial<NavigatorConfigFormData>) {
    if (!this.editing) return;
    this.editing = { ...this.editing, ...patch };
  }

  private updateTranslationField(
    field: NavigatorTranslationFieldKey,
    language: AppLanguage,
    value: string,
  ) {
    if (!this.editing) return;
    const [updated] = updateNavigatorConfigTranslationField(
      [this.editing],
      this.editing.id,
      field,
      language,
      value,
    );
    this.editing = updated;
  }

  private async translateMissing() {
    const config = this.editing;
    if (!config) return;
    if (this.targetLanguages.length === 0) {
      this.error = __('Seleziona almeno una lingua aggiuntiva per tradurre il navigator');
      return;
    }

    this.translating = true;
    this.error = '';
    try {
      const patch = await computeNavigatorMissingTranslations(
        config,
        this.sourceLanguage,
        this.targetLanguages,
      );
      if (!patch) {
        this.success = __('Le traduzioni navigator sono già complete');
        return;
      }
      this.editing = { ...config, ...patch };
      this.success = __('Traduzioni navigator generate con successo');
    } catch {
      this.error = __('Traduzione automatica non riuscita');
    } finally {
      this.translating = false;
    }
  }

  private validateBeforeSave(): string | null {
    const config = this.editing;
    if (!config) return __('Nessuna configurazione da salvare');
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
    const config = this.editing!;
    const clean = (value: Partial<Record<AppLanguage, string>>) =>
      cleanTranslationMap(value, this.sourceLanguage, this.targetLanguages);

    return {
      name: config.name,
      slug: sanitizeSlug(config.slug),
      applicability: 'museum',
      museumId: this.museumId,
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
        homeTitleTranslations: clean(config.homeTitleTranslations),
        welcomeText: config.welcomeText || undefined,
        welcomeTextTranslations: clean(config.welcomeTextTranslations),
        openingImage: config.openingImage || undefined,
      },
      pwa: {
        manifestName: config.manifestName,
        shortName: config.shortName,
        description: config.manifestDescription || undefined,
        descriptionTranslations: clean(config.manifestDescriptionTranslations),
        themeColor: config.themeColor,
        backgroundColor: config.backgroundColor,
        display: config.display,
        orientation: config.orientation,
        startUrl: config.startUrl || '/',
        scope: config.scope || '/',
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
    try {
      const payload = this.toPayload();
      const isNew = !this.editing!.id;
      // applicability/museumId sono immutabili dopo la creazione: in update
      // non vanno inviati (UpdateNavigatorConfigData non li accetta nemmeno).
      const result = isNew
        ? await navigatorConfigService.create(payload)
        : await navigatorConfigService.update(this.editing!.id, {
            name: payload.name,
            slug: payload.slug,
            branding: payload.branding,
            content: payload.content,
            pwa: payload.pwa,
          });

      if (result.error || !result.data) {
        this.error = result.error || __('Errore durante il salvataggio della configurazione');
      } else {
        this.success = __('Configurazione salvata con successo');
        this.editing = null;
        await this.loadConfigs();
      }
    } finally {
      this.saving = false;
    }
  }

  private async removeConfig(config: NavigatorConfigFormData) {
    const confirmed = await modalService.confirm({
      title: __('Elimina configurazione'),
      message: `${__('Sei sicuro di voler eliminare la configurazione')} "${config.name}"? ${__('Questa azione è irreversibile.')}`,
      confirmLabel: __('Elimina'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this.deletingId = config.id;
    this.error = '';
    try {
      const result = await navigatorConfigService.delete(config.id);
      if (result.success) {
        this.success = __('Configurazione eliminata con successo');
        if (this.editing?.id === config.id) this.editing = null;
        await this.loadConfigs();
      } else {
        this.error = result.error || __("Errore durante l'eliminazione della configurazione");
      }
    } catch {
      this.error = __("Errore durante l'eliminazione della configurazione");
    } finally {
      this.deletingId = null;
    }
  }

  private openManifestPreview(config: NavigatorConfigFormData) {
    if (!config.slug) return;
    window.open(
      `/api/navigator-configs/manifest?slug=${encodeURIComponent(config.slug)}`,
      '_blank',
    );
  }

  // Apre l'app Navigator vera e propria con questa config attiva (?ncfg=slug,
  // stesso parametro letto da navigatorConfigStore.ts lato Navigator).
  private openNavigatorPreview(config: NavigatorConfigFormData) {
    if (!config.slug) return;
    window.open(`/navigator/?ncfg=${encodeURIComponent(config.slug)}`, '_blank');
  }

  private renderList() {
    if (this.configs.length === 0) {
      return html`<ui-empty
        .title=${__('Nessuna personalizzazione navigator')}
        .description=${__(
          'Questo museo non ha configurazioni navigator personalizzate. Usa "Nuova configurazione" per crearne una.',
        )}
        icon="cog"
      ></ui-empty>`;
    }

    return html`
      <div class="space-y-3">
        ${this.configs.map(
          (config) => html`
            <ui-card padding="none">
              <div class="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-3 flex-wrap">
                  <span class="font-medium text-surface-900 dark:text-white">${config.name}</span>
                  <ui-badge variant="secondary" .label=${config.slug}></ui-badge>
                </div>
                <div class="flex items-center gap-2">
                  <ui-button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon="download"
                    .label=${__('Anteprima manifest')}
                    @click=${() => this.openManifestPreview(config)}
                  ></ui-button>
                  <ui-button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon="link"
                    .label=${__('Apri Navigator')}
                    @click=${() => this.openNavigatorPreview(config)}
                  ></ui-button>
                  <ui-icon-button
                    icon="edit"
                    .title=${__('Modifica')}
                    @click=${() => this.openEdit(config)}
                  ></ui-icon-button>
                  <ui-icon-button
                    icon="trash"
                    variant="danger"
                    .title=${__('Elimina')}
                    .loading=${this.deletingId === config.id}
                    @click=${() => this.removeConfig(config)}
                  ></ui-icon-button>
                </div>
              </div>
            </ui-card>
          `,
        )}
      </div>
    `;
  }

  private renderEditor(config: NavigatorConfigFormData) {
    const sourceLanguageLabel = getAppLanguageLabel(this.sourceLanguage);

    return html`
      <ui-card padding="none">
        <div class="p-6 space-y-5">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-surface-900 dark:text-white">
              ${config.id ? __('Modifica configurazione') : __('Nuova configurazione')}
            </h4>
            <div class="flex items-center gap-2">
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                icon="download"
                .label=${__('Anteprima manifest')}
                ?disabled=${!config.id}
                @click=${() => this.openManifestPreview(config)}
              ></ui-button>
              <ui-button
                type="button"
                variant="secondary"
                size="sm"
                icon="link"
                .label=${__('Apri Navigator')}
                ?disabled=${!config.id}
                @click=${() => this.openNavigatorPreview(config)}
              ></ui-button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ui-input
              .label=${__('Nome Config *')}
              .help=${__(
                "Solo per riconoscerla qui nell'elenco delle configurazioni — non è mai visibile ai visitatori del Navigator.",
              )}
              .value=${config.name}
              @input-change=${(e: CustomEvent) => this.updateEditing({ name: e.detail.value })}
              required
            ></ui-input>
            <ui-input
              .label=${__('Slug *')}
              .help=${__(
                'Identificatore univoco nel link/QR di questa configurazione (?ncfg=slug). Cambiarlo dopo la pubblicazione invalida i link e i QR già distribuiti.',
              )}
              .value=${config.slug}
              @input-change=${(e: CustomEvent) =>
                this.updateEditing({ slug: sanitizeSlug(e.detail.value) })}
              required
            ></ui-input>
            <ui-input
              .label=${__('Titolo di benvenuto')}
              .help=${__('Titolo mostrato nella schermata Home del Navigator, sotto il logo.')}
              .value=${config.homeTitle}
              @input-change=${(e: CustomEvent) => this.updateEditing({ homeTitle: e.detail.value })}
            ></ui-input>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ui-input
              .label=${__('Nome manifest *')}
              .help=${__(
                "Nome completo dell'app mostrato durante l'installazione e nel selettore app del telefono.",
              )}
              .value=${config.manifestName}
              @input-change=${(e: CustomEvent) =>
                this.updateEditing({ manifestName: e.detail.value })}
              required
            ></ui-input>
            <ui-input
              .label=${__('Nome breve manifest *')}
              .help=${__(
                "Nome mostrato sotto l'icona nella schermata Home: tienilo breve, gli schermi tagliano i nomi troppo lunghi.",
              )}
              .value=${config.shortName}
              @input-change=${(e: CustomEvent) => this.updateEditing({ shortName: e.detail.value })}
              required
            ></ui-input>
            ${renderNavigatorColorField(
              config,
              'primaryColor' as NavigatorColorFieldKey,
              __('Colore primario'),
              '#0ea5e9',
              (patch) => this.updateEditing(patch),
              __(
                'Colore principale del Navigator per questa configurazione: pulsanti, gradiente, elementi in evidenza.',
              ),
            )}
            ${renderNavigatorColorField(
              config,
              'secondaryColor' as NavigatorColorFieldKey,
              __('Colore secondario'),
              '#1f2937',
              (patch) => this.updateEditing(patch),
              __(
                'Colore secondario del Navigator per questa configurazione (opposto al colore primario, nel gradiente).',
              ),
            )}
            ${renderNavigatorColorField(
              config,
              'appBackgroundColor' as NavigatorColorFieldKey,
              __('Colore sfondo app'),
              '#0b0813',
              (patch) => this.updateEditing(patch),
              __(
                'Sfondo di tutte le schermate del Navigator: da questo colore vengono derivate automaticamente le sue sfumature (card, bordi, testo).',
              ),
            )}
            ${renderNavigatorColorField(
              config,
              'themeColor' as NavigatorColorFieldKey,
              __('Colore tema'),
              '#0ea5e9',
              (patch) => this.updateEditing(patch),
              __(
                "Colore della barra di stato/indirizzo del browser e della splash screen quando l'app è installata sul telefono.",
              ),
            )}
            ${renderNavigatorColorField(
              config,
              'backgroundColor' as NavigatorColorFieldKey,
              __('Colore sfondo manifest/splash'),
              '#ffffff',
              (patch) => this.updateEditing(patch),
              __(
                "Sfondo mostrato per una frazione di secondo all'avvio dell'app installata, prima che venga caricata la vera schermata.",
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
                this.updateEditing({ displayFont: e.detail.value })}
            ></ui-select>
            <ui-select
              .label=${__('Font testo')}
              .help=${__('Font usato per il corpo dei testi (descrizioni, paragrafi).')}
              .value=${config.bodyFont}
              .options=${NAVIGATOR_FONT_SELECT_OPTIONS}
              placeholder=${__('Predefinito')}
              @select-change=${(e: CustomEvent) => this.updateEditing({ bodyFont: e.detail.value })}
            ></ui-select>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ui-select
              .label=${__('Visualizzazione')}
              .help=${__(
                "Come appare l'app una volta installata sul telefono: standalone nasconde la UI del browser mantenendo la barra di stato, fullscreen nasconde anche quella, minimal-ui lascia pochi controlli di navigazione, browser la apre come una normale scheda.",
              )}
              .value=${config.display}
              .options=${DISPLAY_OPTIONS}
              @select-change=${(e: CustomEvent) =>
                this.updateEditing({
                  display: e.detail.value as NavigatorConfigFormData['display'],
                })}
            ></ui-select>
            <ui-select
              .label=${__('Orientamento')}
              .help=${__(
                'Blocca l\'app installata su un orientamento (verticale/orizzontale) oppure segue quello del dispositivo ("any").',
              )}
              .value=${config.orientation}
              .options=${ORIENTATION_OPTIONS}
              @select-change=${(e: CustomEvent) =>
                this.updateEditing({
                  orientation: e.detail.value as NavigatorConfigFormData['orientation'],
                })}
            ></ui-select>
            <ui-input
              .label=${__('URL iniziale')}
              .help=${__(
                'Pagina aperta quando si avvia l\'app installata dall\'icona in home screen. Di norma "/navigator/" (la Home del Navigator).',
              )}
              .value=${config.startUrl}
              @input-change=${(e: CustomEvent) =>
                this.updateEditing({ startUrl: e.detail.value || '/' })}
            ></ui-input>
            <ui-input
              .label=${__('Ambito')}
              .help=${__(
                'Percorso entro cui l\'app resta "installata": uscendo da questo ambito, i link si aprono nel browser normale invece che nell\'app (di norma "/navigator/").',
              )}
              .value=${config.scope}
              @input-change=${(e: CustomEvent) =>
                this.updateEditing({ scope: e.detail.value || '/' })}
            ></ui-input>
          </div>

          <ui-textarea
            .label=${__('Testo di benvenuto')}
            .help=${__(
              'Testo mostrato nella schermata di benvenuto, prima che il visitatore entri nel Navigator — se vuoto, quella schermata non compare affatto.',
            )}
            .value=${config.welcomeText}
            @textarea-change=${(e: CustomEvent) =>
              this.updateEditing({ welcomeText: e.detail.value })}
            rows="3"
          ></ui-textarea>

          <ui-textarea
            .label=${__('Descrizione manifest')}
            .help=${__(
              "Descrizione tecnica dell'app usata dal sistema operativo (es. nella schermata di conferma installazione) — non compare mai dentro il Navigator stesso.",
            )}
            .value=${config.manifestDescription}
            @textarea-change=${(e: CustomEvent) =>
              this.updateEditing({ manifestDescription: e.detail.value })}
            rows="2"
          ></ui-textarea>

          ${renderNavigatorTranslationsSection({
            config,
            sourceLanguageLabel,
            targetLanguages: this.targetLanguages,
            selectedLanguage: this.translationLanguage || this.targetLanguages[0] || null,
            getLanguageLabel: (lang) => getAppLanguageLabel(lang),
            onSelectLanguage: (lang) => {
              this.translationLanguage = lang;
            },
            onUpdateField: (field, lang, value) => this.updateTranslationField(field, lang, value),
            emptyTargetsMessage: __(
              'Aggiungi almeno una lingua aggiuntiva nelle Lingue attive del museo per gestire le traduzioni navigator.',
            ),
            translateMissing: {
              label: __('Traduci campi navigator mancanti con AI'),
              loading: this.translating,
              disabled: this.targetLanguages.length === 0,
              onClick: () => this.translateMissing(),
            },
          })}

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            ${renderNavigatorImageEditors(config, this.imageEditors, (key, path) =>
              this.updateEditing({ [key]: path || '' } as Partial<NavigatorConfigFormData>),
            )}
          </div>

          <div
            class="flex justify-end gap-3 pt-4 border-t border-surface-200 dark:border-surface-700"
          >
            <ui-button
              type="button"
              variant="secondary"
              .label=${__('Annulla')}
              @click=${() => (this.editing = null)}
            ></ui-button>
            <ui-button
              type="button"
              variant="primary"
              icon="check"
              .label=${__('Salva configurazione')}
              .loading=${this.saving}
              @click=${() => this.save()}
            ></ui-button>
          </div>
        </div>
      </ui-card>
    `;
  }

  render() {
    return html`
      <div class="space-y-4">
        ${renderFeedbackAlerts({ error: this.error, success: this.success })}

        <div class="flex items-start justify-between gap-3">
          <h3
            class="text-lg font-semibold text-surface-900 dark:text-white flex items-center gap-2 flex-wrap"
          >
            <ui-icon name="cog" size="sm" class="text-purple-500"></ui-icon>
            ${__('Configurazioni Navigator')}
            <ui-info-tip
              variant="inline"
              text=${__(
                'Branding e manifest del Navigator specifici per questo museo (colori, font, icone, testo di benvenuto). Se non ne crei una, il museo usa la Configurazione globale Navigator. Un museo può averne più di una, raggiungibili con link/QR diversi (?ncfg=slug).',
              )}
            ></ui-info-tip>
          </h3>
          ${!this.editing
            ? html`<ui-button
                type="button"
                variant="secondary"
                size="sm"
                icon="plus"
                .label=${__('Nuova configurazione')}
                @click=${() => this.openNew()}
              ></ui-button>`
            : nothing}
        </div>

        ${this.loading ? html`<ui-loading></ui-loading>` : nothing}
        ${!this.loading && !this.editing ? this.renderList() : nothing}
        ${this.editing ? this.renderEditor(this.editing) : nothing}
      </div>
    `;
  }
}
