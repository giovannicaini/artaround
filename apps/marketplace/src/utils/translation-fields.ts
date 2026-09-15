/*
 * File: /src/utils/translation-fields.ts                                                *
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

/**
 * Helper condivisi per i campi tradotti (mappa lingua→testo) usati da item, visite e config Navigator.
 */
export type LanguageCode = string;

export type TranslationMap<TLanguage extends LanguageCode = LanguageCode> = Partial<
  Record<TLanguage, string>
>;

export type TranslatableField<TLanguage extends LanguageCode = LanguageCode> = {
  source: string;
  translations: TranslationMap<TLanguage>;
};

export function isLanguageFullyTranslated<TLanguage extends LanguageCode>(
  fields: Array<TranslatableField<TLanguage>>,
  language: TLanguage,
): boolean {
  const hasAnyTranslationValue = fields.some((field) =>
    Boolean(String(field.translations[language] || '').trim()),
  );

  if (!hasAnyTranslationValue) {
    return false;
  }

  return fields.every((field) => {
    const sourceValue = String(field.source || '').trim();
    const translatedValue = String(field.translations[language] || '').trim();

    if (!sourceValue) {
      return true;
    }

    return Boolean(translatedValue);
  });
}

// Tiene solo le lingue target non vuote e diverse dalla sorgente.
export function cleanTranslationMap<TLanguage extends LanguageCode>(
  values: TranslationMap<TLanguage>,
  source: TLanguage,
  targets: TLanguage[],
): TranslationMap<TLanguage> | undefined {
  const targetSet = new Set(targets);
  const cleaned: TranslationMap<TLanguage> = {};

  for (const [langRaw, valueRaw] of Object.entries(values)) {
    const lang = langRaw as TLanguage;
    const value = String(valueRaw || '').trim();
    if (!value || lang === source || !targetSet.has(lang)) continue;
    cleaned[lang] = value;
  }

  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

// Un campo tradotto dal server può essere una Map (Mongo) invece dell'oggetto plain atteso.
export function normalizeTranslationMap<TLanguage extends LanguageCode>(
  value: TranslationMap<TLanguage> | Map<TLanguage, string> | undefined,
): TranslationMap<TLanguage> {
  if (!value) return {};
  return value instanceof Map
    ? (Object.fromEntries(value.entries()) as TranslationMap<TLanguage>)
    : value;
}

export function buildTranslationLanguageOptions<TLanguage extends LanguageCode>(
  languages: TLanguage[],
  getLanguageLabel: (language: TLanguage) => string,
  isTranslated: (language: TLanguage) => boolean,
  labels: {
    translated: string;
    toTranslate: string;
  },
): Array<{ value: TLanguage; label: string }> {
  return languages.map((language) => {
    const languageLabel = getLanguageLabel(language);
    const statusLabel = isTranslated(language) ? labels.translated : labels.toTranslate;

    return {
      value: language,
      label: `${languageLabel} • ${statusLabel}`,
    };
  });
}
