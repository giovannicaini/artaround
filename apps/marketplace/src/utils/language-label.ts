import { APP_LANGUAGE_META, type AppLanguage } from '@artaround/shared';
import { __ } from '../services/i18n.service';

/**
 * Nome visualizzato di una lingua app, tradotto nella lingua corrente (non fisso come APP_LANGUAGE_META).
 */
export function getAppLanguageLabel(lang: AppLanguage): string {
  return __(APP_LANGUAGE_META[lang]?.label || lang.toUpperCase());
}
