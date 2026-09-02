import type { AppLanguage } from '@artaround/shared';
import { localesByLanguage } from '@artaround/shared';

const SUPPORTED_LANGUAGES: AppLanguage[] = ['it', 'en', 'fr', 'de', 'es'];

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

// la chiave di traduzione è il testo italiano stesso, non un id astratto
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

const BCP47_BY_LANGUAGE: Record<AppLanguage, string> = {
  it: 'it-IT',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};

export function toSpeechLocale(language: AppLanguage): string {
  return BCP47_BY_LANGUAGE[language];
}

const STORAGE_KEY = 'uiLanguage'; // stessa chiave del marketplace: la scelta si condivide tra le due app (stesso dominio)

export function loadStoredLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (saved && SUPPORTED_LANGUAGES.includes(saved)) return saved;
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

// traduce un campo con una mappa *Translations opzionale a fianco
export function localizedField(
  language: AppLanguage,
  base: string,
  translations?: Partial<Record<AppLanguage, string>>,
): string {
  if (language === 'it') return base;
  return translations?.[language] || base;
}

// sostituisce i segnaposto {nome} in un template già tradotto
export function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? '');
}

export { SUPPORTED_LANGUAGES };
