import { useCallback } from 'react';
import { useI18nStore } from '../stores/i18nStore';
import { translate } from '../lib/i18n';

/**
 * `t('Testo in italiano')` → stringa nella lingua corrente. La chiave è il
 * testo sorgente stesso (come nel marketplace), non un identificatore
 * astratto: leggibile nel codice, e se manca una traduzione il fallback è
 * comunque un testo sensato invece di una chiave grezza.
 */
export function useT() {
  const language = useI18nStore((state) => state.language);
  return useCallback((textOrKey: string) => translate(language, textOrKey), [language]);
}
