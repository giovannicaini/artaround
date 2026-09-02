import type { AppLanguage } from '@artaround/shared';
import { localesByLanguage, type I18nDictionary } from '@artaround/shared';

const DICTIONARIES: Record<AppLanguage, I18nDictionary> = {
  it: localesByLanguage.it,
  en: localesByLanguage.en,
  fr: localesByLanguage.fr,
  de: localesByLanguage.de,
  es: localesByLanguage.es,
};

const normalizeKey = (value: string): string =>
  value
    .normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

const buildNormalizedIndex = (dictionary: I18nDictionary): Map<string, string> => {
  const index = new Map<string, string>();
  for (const [key, value] of Object.entries(dictionary)) {
    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }
    index.set(normalizeKey(key), value);
  }
  return index;
};

const NORMALIZED_DICTIONARIES: Record<AppLanguage, Map<string, string>> = {
  it: buildNormalizedIndex(DICTIONARIES.it),
  en: buildNormalizedIndex(DICTIONARIES.en),
  fr: buildNormalizedIndex(DICTIONARIES.fr),
  de: buildNormalizedIndex(DICTIONARIES.de),
  es: buildNormalizedIndex(DICTIONARIES.es),
};

class I18nService {
  private static readonly STORAGE_KEY = 'uiLanguage';
  private currentLanguage: AppLanguage = 'it';

  constructor() {
    this.currentLanguage = this.loadLanguage();
    this.applyLanguageToDocument(this.currentLanguage);
  }

  getLanguage(): AppLanguage {
    return this.currentLanguage;
  }

  setLanguage(language: AppLanguage): void {
    this.currentLanguage = language;
    try {
      localStorage.setItem(I18nService.STORAGE_KEY, language);
    } catch {
      // ignora gli errori di storage
    }

    this.applyLanguageToDocument(language);
    this.requestGlobalUpdate();

    window.dispatchEvent(
      new CustomEvent('ui-language-changed', {
        detail: { language },
      }),
    );
  }

  t(textOrKey: string): string {
    const currentDictionary = DICTIONARIES[this.currentLanguage];
    const baseDictionary = DICTIONARIES.it;

    const currentValue = currentDictionary[textOrKey];
    if (typeof currentValue === 'string' && currentValue.trim() !== '') {
      return currentValue;
    }

    const baseValue = baseDictionary[textOrKey];
    if (typeof baseValue === 'string' && baseValue.trim() !== '') {
      return baseValue;
    }

    const normalizedKey = normalizeKey(textOrKey);
    const normalizedCurrentValue = NORMALIZED_DICTIONARIES[this.currentLanguage].get(normalizedKey);
    if (normalizedCurrentValue) {
      return normalizedCurrentValue;
    }

    const normalizedBaseValue = NORMALIZED_DICTIONARIES.it.get(normalizedKey);
    if (normalizedBaseValue) {
      return normalizedBaseValue;
    }

    return textOrKey;
  }

  private loadLanguage(): AppLanguage {
    try {
      const saved = localStorage.getItem(I18nService.STORAGE_KEY) as AppLanguage | null;
      if (saved && ['it', 'en', 'fr', 'de', 'es'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignora
    }

    return 'it';
  }

  private applyLanguageToDocument(language: AppLanguage): void {
    document.documentElement.lang = language;
  }

  private requestGlobalUpdate(): void {
    const allElements = document.querySelectorAll('*');
    for (const element of allElements) {
      const maybeLitElement = element as Element & { requestUpdate?: () => void };
      if (typeof maybeLitElement.requestUpdate === 'function') {
        maybeLitElement.requestUpdate();
      }
    }
  }
}

export const i18nService = new I18nService();

export const __ = (textOrKey: string): string => i18nService.t(textOrKey);
