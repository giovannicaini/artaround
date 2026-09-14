import { DEFAULT_APP_LANGUAGE, type AppLanguage } from '@artaround/shared';
import { i18nService } from '../services/i18n.service';

/**
 * Testo utente nella lingua dell'interfaccia corrente, con fallback al testo sorgente se manca la traduzione.
 */
export function getLocalizedText(
  source: string,
  translations: Partial<Record<AppLanguage, string>> | undefined,
  language: AppLanguage = i18nService.getLanguage(),
): string {
  if (language === DEFAULT_APP_LANGUAGE) return source;
  return translations?.[language]?.trim() || source;
}
