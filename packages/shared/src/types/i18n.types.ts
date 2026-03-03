export const SUPPORTED_APP_LANGUAGES = ['it', 'en', 'fr', 'de', 'es'] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'it';

export const isSupportedAppLanguage = (value: string): value is AppLanguage =>
  SUPPORTED_APP_LANGUAGES.includes(value as AppLanguage);
