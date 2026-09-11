import { useCallback } from 'react';
import { useI18nStore } from '../context/i18nStore';
import { translate } from './i18n';

/** `t('Testo in italiano')` → stringa nella lingua corrente. */
export function useT() {
  const language = useI18nStore((state) => state.language);
  return useCallback((textOrKey: string) => translate(language, textOrKey), [language]);
}
