/*
 * File: /src/services/i18n.ts                                                           *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
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
 * Servizio i18n usato dall'app Navigator.
 * Fornisce: lista lingue supportate, traduzione di stringhe/chiavi,
 * normalizzazione per ricerche fuzz, helper per la sintesi vocale
 * (`toSpeechLocale`) e funzioni per caricare/salvare la lingua utente.
 */
import type { AppLanguage } from '@artaround/shared';
import { localesByLanguage, isSupportedAppLanguage, BCP47_BY_LANGUAGE } from '@artaround/shared';

const normalizeKey = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/ /g, ' ')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const normalizedIndexCache = new Map<AppLanguage, Map<string, string>>();

function normalizedIndex(language: AppLanguage): Map<string, string> {
  const cached = normalizedIndexCache.get(language);
  if (cached) return cached;

  const index = new Map<string, string>();
  for (const [key, value] of Object.entries(localesByLanguage[language])) {
    if (typeof value === 'string' && value.trim() !== '') {
      index.set(normalizeKey(key), value);
    }
  }
  normalizedIndexCache.set(language, index);
  return index;
}

// La chiave di traduzione è il testo sorgente in italiano, i dizionari sono in @shared condivisi
export function translate(language: AppLanguage, textOrKey: string): string {
  const current = localesByLanguage[language][textOrKey];
  if (typeof current === 'string' && current.trim() !== '') return current;

  const base = localesByLanguage.it[textOrKey];
  if (typeof base === 'string' && base.trim() !== '') return base;

  const normalizedKey = normalizeKey(textOrKey);
  const normalizedCurrent = normalizedIndex(language).get(normalizedKey);
  if (normalizedCurrent) return normalizedCurrent;

  const normalizedBase = normalizedIndex('it').get(normalizedKey);
  if (normalizedBase) return normalizedBase;

  return textOrKey;
}

/** Codice lingua per la sintesi vocale */
export function toSpeechLocale(language: AppLanguage): string {
  return BCP47_BY_LANGUAGE[language];
}

// stessa chiave del marketplace: condivisa tra le due app (stesso dominio)
const STORAGE_KEY = 'uiLanguage';

export function loadStoredLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && isSupportedAppLanguage(saved)) return saved;
  } catch {
    // storage non disponibile: si resta sul default
  }
  return 'it';
}

export function storeLanguage(language: AppLanguage): void {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // ignorato
  }
}

// Traduzione di un campo di contenuto (nome museo, titolo visita, ...)
// che porta con sé una mappa "Translations" opzionale
export function localizedField(
  language: AppLanguage,
  base: string,
  translations?: Partial<Record<AppLanguage, string>>,
): string {
  if (language === 'it') return base;
  return translations?.[language] || base;
}

// Sostituisce i segnaposto {nome} in un template già tradotto — per le
// frasi generate a runtime (risposte vocali con nomi propri dentro).
export function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}
