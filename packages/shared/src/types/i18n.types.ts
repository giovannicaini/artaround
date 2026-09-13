/**
 * Tipi i18n (traduzione)
 *
 * Lingue supportate da Marketplace/Navigator a livello globale (ovvero,
 * usate per tradurre tutte le stringhe "fisse" presenti nell'app).
 * In @shared/src/locales ci sono i json con la traduzione di tali stringhe.
 */

export const SUPPORTED_APP_LANGUAGES = ['it', 'en', 'fr', 'de', 'es'] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'it';

export const isSupportedAppLanguage = (value: string): value is AppLanguage =>
  SUPPORTED_APP_LANGUAGES.includes(value as AppLanguage);

/** Codice BCP47 per lingua — usato per la sintesi/riconoscimento vocale
 * (SpeechSynthesisUtterance.lang, SpeechRecognition.lang) sia in Marketplace
 * che in Navigator. */
export const BCP47_BY_LANGUAGE: Record<AppLanguage, string> = {
  it: 'it-IT',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};
