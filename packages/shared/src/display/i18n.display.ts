import { AppLanguage, SUPPORTED_APP_LANGUAGES } from '../types/i18n.types';

export const APP_LANGUAGE_META: Readonly<Record<AppLanguage, { label: string; flagCode: string }>> =
  {
    it: { label: 'Italiano', flagCode: 'it' },
    en: { label: 'English', flagCode: 'us' },
    fr: { label: 'Français', flagCode: 'fr' },
    de: { label: 'Deutsch', flagCode: 'de' },
    es: { label: 'Español', flagCode: 'es' },
  };

export const APP_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: AppLanguage;
  label: string;
  flagCode: string;
}> = SUPPORTED_APP_LANGUAGES.map((value) => ({ value, ...APP_LANGUAGE_META[value] }));
