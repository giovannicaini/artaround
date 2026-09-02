import { useCallback } from 'react';
import { useI18nStore } from '../context/i18nStore';
import { translate } from './i18n';

// la chiave è il testo italiano stesso, come nel marketplace
export function useT() {
  const language = useI18nStore((state) => state.language);
  return useCallback((textOrKey: string) => translate(language, textOrKey), [language]);
}
