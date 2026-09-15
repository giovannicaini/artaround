/*
 * File: /src/utils/navigator-config.ts                                                  *
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

/*
 * File: /src/utils/navigator-config.ts                                                  *
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

import { html, nothing } from 'lit';
import { NAVIGATOR_FONT_OPTIONS, type AppLanguage } from '@artaround/shared';
import { isLanguageFullyTranslated, buildTranslationLanguageOptions } from './translation-fields';
import { __ } from '../services/i18n.service';
import { translationService } from '../services/translation.service';
import type { TourSlide } from '../components/ui/ui-tour';

/**
 * Helper condivisi tra i due editor di NavigatorConfig (globale e per museo): tour,
 * opzioni font, editor immagini, campo colore e sezione traduzioni.
 */
// Tour dell'editor NavigatorConfig, condiviso tra config globale e "Configurazioni Navigator" per museo.
export function getNavigatorConfigTourSlides(): TourSlide[] {
  return [
    {
      icon: 'cog',
      title: __('Globale o per museo'),
      description: __(
        'Una configurazione "globale" vale per tutto l\'ecosistema quando un museo non ne ha una propria; una "per museo" si applica solo a quel museo — un museo può averne più di una, raggiungibili con link/QR diversi.',
      ),
    },
    {
      icon: 'location',
      title: __('Slug e link/QR'),
      description: __(
        "Lo slug è l'identificatore nel link (?ncfg=slug) o nel QR distribuito ai visitatori — cambiarlo dopo la pubblicazione invalida tutto ciò che è già stato stampato o condiviso.",
      ),
    },
    {
      icon: 'image',
      title: __('Colori e font'),
      description: __(
        "Colore primario/secondario, sfondo dell'app e font di titoli/testo definiscono l'aspetto del Navigator per questa configurazione — cambiano solo quella, non le altre.",
      ),
    },
    {
      icon: 'document',
      title: __('Immagini e icone'),
      description: __(
        'Logo, immagine di apertura e le icone PWA (192/512/maskable/Apple) — ognuna ha un uso specifico spiegato dalla sua (i): non sono intercambiabili.',
      ),
    },
    {
      icon: 'check',
      title: __('Impostazioni PWA'),
      description: __(
        "Visualizzazione, orientamento, URL iniziale e ambito riguardano solo l'app una volta installata sulla schermata Home — non incidono su come appare nel browser normale.",
      ),
    },
    {
      icon: 'euro',
      title: __('Anteprima prima di pubblicare'),
      description: __(
        '"Apri Navigator" e "Anteprima manifest" mostrano subito l\'effetto delle modifiche già salvate, senza dover distribuire link o QR per verificarle.',
      ),
    },
  ];
}

// Forma "piatta" di una NavigatorConfig usata dai form di editing lato marketplace (traduzioni espanse come proprietà dirette…
export interface NavigatorConfigFormData {
  id: string; // vuoto per una config non ancora salvata
  name: string;
  slug: string;
  applicability: 'global' | 'museum';
  museumId: string; // vuoto quando applicability === 'global'
  logo: string;
  splashImage: string;
  primaryColor: string;
  secondaryColor: string;
  appBackgroundColor: string; // sfondo reale dell'app (branding.backgroundColor) — diverso da backgroundColor sotto (pwa.backgroundColor, manifest/splash)
  displayFont: string; // id da NAVIGATOR_FONT_OPTIONS, vuoto = default dell'app
  bodyFont: string;
  homeTitle: string;
  homeTitleTranslations: Partial<Record<AppLanguage, string>>;
  welcomeText: string;
  welcomeTextTranslations: Partial<Record<AppLanguage, string>>;
  openingImage: string;
  featuredMuseumId: string; // solo sulla config globale — museo mostrato in evidenza in Home
  manifestName: string;
  shortName: string;
  manifestDescription: string;
  manifestDescriptionTranslations: Partial<Record<AppLanguage, string>>;
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

export type NavigatorColorFieldKey =
  | 'primaryColor'
  | 'secondaryColor'
  | 'appBackgroundColor'
  | 'themeColor'
  | 'backgroundColor';

export type NavigatorTranslationFieldKey =
  | 'homeTitleTranslations'
  | 'welcomeTextTranslations'
  | 'manifestDescriptionTranslations';

// Opzioni per i due <ui-select> font (titoli/testo) — un solo posto invece di duplicare la lista.
export const NAVIGATOR_FONT_SELECT_OPTIONS = NAVIGATOR_FONT_OPTIONS.map((f) => ({
  value: f.id,
  label: f.label,
  fontFamily: f.family,
}));

export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeHexColor(value: string, fallback = '#000000'): string {
  const normalized = value.trim();
  return HEX_COLOR_REGEX.test(normalized) ? normalized : fallback;
}

export function isNavigatorConfigLanguageFullyTranslated(
  config: NavigatorConfigFormData,
  language: AppLanguage,
): boolean {
  const fields = [
    { source: config.homeTitle, translations: config.homeTitleTranslations },
    { source: config.welcomeText, translations: config.welcomeTextTranslations },
    { source: config.manifestDescription, translations: config.manifestDescriptionTranslations },
  ];

  return isLanguageFullyTranslated(fields, language);
}

export function updateNavigatorConfigTranslationField(
  configs: NavigatorConfigFormData[],
  configId: string,
  fieldKey: NavigatorTranslationFieldKey,
  language: AppLanguage,
  value: string,
): NavigatorConfigFormData[] {
  return configs.map((config) => {
    if (config.id !== configId) {
      return config;
    }

    return {
      ...config,
      [fieldKey]: {
        ...(config[fieldKey] || {}),
        [language]: value,
      },
    };
  });
}

// ─── Editor di immagini (branding + PWA icons) ─────────────────────
// Condiviso tra editor per museo e config globale: stesso set di upload/crop widget.
export type NavigatorImageFieldKey =
  | 'logo'
  | 'splashImage'
  | 'openingImage'
  | 'icon192'
  | 'icon512'
  | 'iconMaskable'
  | 'appleTouchIcon';

export interface NavigatorImageEditorDefinition {
  key: NavigatorImageFieldKey;
  label: string;
  help?: string;
  maxWidth: number;
  maxHeight: number;
  defaultFormat: 'png' | 'webp';
}

// Funzione (non costante di modulo) così le label passano da __() nel
// momento in cui vengono richieste, non al primo import del modulo.
export function getNavigatorImageEditorDefinitions(): NavigatorImageEditorDefinition[] {
  return [
    {
      key: 'logo',
      label: __('Logo'),
      help: __(
        "Icona quadrata mostrata nell'header del Navigator e come icona dell'app una volta installata sulla schermata Home.",
      ),
      maxWidth: 512,
      maxHeight: 512,
      defaultFormat: 'png',
    },
    {
      key: 'splashImage',
      label: __('Immagine di apertura'),
      help: __(
        'Sfondo a schermo intero mostrato nella schermata di benvenuto, prima che il visitatore entri nel Navigator.',
      ),
      maxWidth: 1440,
      maxHeight: 2560,
      defaultFormat: 'webp',
    },
    {
      key: 'icon192',
      label: __('Icon 192x192'),
      help: __(
        "Icona dell'app richiesta dal manifest PWA per Android/Chrome — dimensione fissa, non modificabile.",
      ),
      maxWidth: 192,
      maxHeight: 192,
      defaultFormat: 'png',
    },
    {
      key: 'icon512',
      label: __('Icon 512x512'),
      help: __(
        'Versione ad alta risoluzione della stessa icona, usata dal manifest PWA per schermate/splash più grandi.',
      ),
      maxWidth: 512,
      maxHeight: 512,
      defaultFormat: 'png',
    },
    {
      key: 'iconMaskable',
      label: __('Icon maskable'),
      help: __(
        "Variante dell'icona con margini di sicurezza extra: alcuni launcher Android la ritagliano in forme diverse (cerchio, squircle...) — senza margine rischia di essere tagliata.",
      ),
      maxWidth: 512,
      maxHeight: 512,
      defaultFormat: 'png',
    },
    {
      key: 'appleTouchIcon',
      label: __('Apple touch icon'),
      help: __(
        "Icona usata da iOS quando l'app viene aggiunta alla schermata Home da Safari — Android/Chrome usano invece le icon192/icon512 sopra.",
      ),
      maxWidth: 180,
      maxHeight: 180,
      defaultFormat: 'png',
    },
  ];
}

// Renderizza un `<image-editor>` per ciascun campo immagine della config (logo, splash, opening image, icone PWA).
export function renderNavigatorImageEditors(
  config: NavigatorConfigFormData,
  definitions: NavigatorImageEditorDefinition[],
  onUpdate: (key: NavigatorImageFieldKey, path: string | undefined) => void,
) {
  return definitions.map(
    (definition) => html`
      <image-editor
        label=${definition.label}
        help=${definition.help || ''}
        category="misc"
        .value=${config[definition.key]}
        maxWidth=${definition.maxWidth}
        maxHeight=${definition.maxHeight}
        defaultFormat=${definition.defaultFormat}
        @image-saved=${(e: CustomEvent) => onUpdate(definition.key, e.detail.path)}
      ></image-editor>
    `,
  );
}

// Campo colore condiviso tra i due editor di NavigatorConfig — richiede import '../ui/ui-color-input'.
export function renderNavigatorColorField(
  config: NavigatorConfigFormData,
  key: NavigatorColorFieldKey,
  label: string,
  fallback: string,
  onUpdate: (patch: Partial<NavigatorConfigFormData>) => void,
  help = '',
) {
  return html`
    <ui-color-input
      hex
      .label=${label}
      .help=${help}
      .value=${normalizeHexColor(config[key], fallback)}
      @input-change=${(e: CustomEvent) =>
        onUpdate({ [key]: e.detail.value } as Partial<NavigatorConfigFormData>)}
    ></ui-color-input>
  `;
}

// ─── Sezione "Traduzioni navigator" ────────────────────────────────
export interface NavigatorTranslateMissingOptions {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}

export interface NavigatorTranslationsSectionOptions {
  config: NavigatorConfigFormData;
  sourceLanguageLabel: string;
  targetLanguages: AppLanguage[];
  selectedLanguage: AppLanguage | null;
  getLanguageLabel: (language: AppLanguage) => string;
  onSelectLanguage: (language: AppLanguage) => void;
  onUpdateField: (
    field: NavigatorTranslationFieldKey,
    language: AppLanguage,
    value: string,
  ) => void;
  // Messaggio mostrato quando non ci sono lingue di destinazione disponibili.
  emptyTargetsMessage?: string;
  // Se presente, mostra il bottone "Traduci campi mancanti con AI".
  translateMissing?: NavigatorTranslateMissingOptions;
}

// Riquadro "Traduzioni navigator" condiviso tra museums-management-page.ts e navigator-default-config-page.ts.
export function renderNavigatorTranslationsSection(options: NavigatorTranslationsSectionOptions) {
  const {
    config,
    sourceLanguageLabel,
    targetLanguages,
    selectedLanguage,
    getLanguageLabel,
    onSelectLanguage,
    onUpdateField,
    emptyTargetsMessage,
    translateMissing,
  } = options;

  const selectedLanguageLabel = selectedLanguage ? getLanguageLabel(selectedLanguage) : null;

  const translationLanguageOptions = buildTranslationLanguageOptions(
    targetLanguages,
    getLanguageLabel,
    (lang) => isNavigatorConfigLanguageFullyTranslated(config, lang),
    { translated: __('Tradotta'), toTranslate: __('Da tradurre') },
  );

  return html`
    <div class="pt-4 border-t border-surface-200 dark:border-surface-700">
      <div
        class="space-y-4 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-100/80 dark:bg-violet-900/25 p-4"
      >
        <div class="flex items-center justify-between flex-wrap gap-2">
          <h5 class="font-medium text-surface-900 dark:text-white">
            ${__('Traduzioni navigator')}
          </h5>
          <div class="flex items-center gap-2 flex-wrap">
            <ui-badge
              variant="secondary"
              .label=${`${__('Lingua sorgente')}: ${sourceLanguageLabel}`}
            ></ui-badge>
            ${translateMissing
              ? html`
                  <ui-button
                    type="button"
                    variant="secondary"
                    size="xs"
                    icon="sparkles"
                    .label=${translateMissing.label}
                    .loading=${translateMissing.loading}
                    .disabled=${translateMissing.disabled}
                    @click=${translateMissing.onClick}
                  ></ui-button>
                `
              : nothing}
          </div>
        </div>

        ${targetLanguages.length === 0
          ? html`<p class="text-xs text-surface-500 dark:text-surface-400">
              ${emptyTargetsMessage || ''}
            </p>`
          : html`
              <div class="space-y-3">
                <ui-select
                  .label=${__('Lingua traduzione')}
                  .value=${selectedLanguage || ''}
                  .options=${translationLanguageOptions}
                  @select-change=${(e: CustomEvent<{ value: AppLanguage }>) =>
                    onSelectLanguage(e.detail.value)}
                ></ui-select>

                ${selectedLanguage
                  ? html`
                      <div
                        class="p-4 rounded-lg border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 space-y-3"
                      >
                        <h6 class="text-sm font-semibold text-surface-800 dark:text-surface-100">
                          ${__('Traduzioni in')}
                          ${selectedLanguageLabel || selectedLanguage.toUpperCase()}
                        </h6>

                        <ui-input
                          .label=${__('Titolo Home')}
                          .value=${config.homeTitleTranslations[selectedLanguage] || ''}
                          @input-change=${(e: CustomEvent) =>
                            onUpdateField(
                              'homeTitleTranslations',
                              selectedLanguage,
                              e.detail.value,
                            )}
                        ></ui-input>

                        <ui-textarea
                          .label=${__('Testo di benvenuto')}
                          .value=${config.welcomeTextTranslations[selectedLanguage] || ''}
                          @textarea-change=${(e: CustomEvent) =>
                            onUpdateField(
                              'welcomeTextTranslations',
                              selectedLanguage,
                              e.detail.value,
                            )}
                          rows="3"
                        ></ui-textarea>

                        <ui-textarea
                          .label=${__('Descrizione manifest')}
                          .value=${config.manifestDescriptionTranslations[selectedLanguage] || ''}
                          @textarea-change=${(e: CustomEvent) =>
                            onUpdateField(
                              'manifestDescriptionTranslations',
                              selectedLanguage,
                              e.detail.value,
                            )}
                          rows="2"
                        ></ui-textarea>
                      </div>
                    `
                  : nothing}
              </div>
            `}
      </div>
    </div>
  `;
}

// Calcola e traduce automaticamente i campi navigator mancanti; ritorna null se non c'è nulla da tradurre.
export async function computeNavigatorMissingTranslations(
  config: NavigatorConfigFormData,
  sourceLanguage: AppLanguage,
  targetLanguages: AppLanguage[],
): Promise<Partial<NavigatorConfigFormData> | null> {
  const fieldSources: Array<{ field: NavigatorTranslationFieldKey; source: string }> = [
    { field: 'homeTitleTranslations', source: config.homeTitle },
    { field: 'welcomeTextTranslations', source: config.welcomeText },
    { field: 'manifestDescriptionTranslations', source: config.manifestDescription },
  ];

  const batchItems: Array<{ key: string; text: string; targetLang: AppLanguage }> = [];
  for (const lang of targetLanguages) {
    for (const { field, source } of fieldSources) {
      if (source.trim() && !config[field][lang]?.trim()) {
        batchItems.push({ key: `${lang}:${field}`, text: source, targetLang: lang });
      }
    }
  }

  if (batchItems.length === 0) return null;

  const translations = await translationService.translateBatch(sourceLanguage, batchItems);

  const patch: Partial<NavigatorConfigFormData> = {};
  for (const { field } of fieldSources) {
    const nextMap: Partial<Record<AppLanguage, string>> = { ...config[field] };
    for (const lang of targetLanguages) {
      const translated = translations[`${lang}:${field}`];
      if (translated) {
        nextMap[lang] = translated;
      }
    }
    (patch as Record<NavigatorTranslationFieldKey, Partial<Record<AppLanguage, string>>>)[field] =
      nextMap;
  }

  return patch;
}
