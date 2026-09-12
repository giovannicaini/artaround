import { LanguageLevel } from '@artaround/shared';
import { useT } from './useT';

/** Emoji+etichetta per ogni LanguageLevel, tradotta nella lingua corrente. */
export function useLanguageLevelMeta(): Record<LanguageLevel, { emoji: string; label: string }> {
  const t = useT();
  return {
    [LanguageLevel.CHILDREN]: { emoji: '👶', label: t('Bambini') },
    [LanguageLevel.ELEMENTARY]: { emoji: '🌱', label: t('Base') },
    [LanguageLevel.MEDIUM]: { emoji: '🌿', label: t('Intermedio') },
    [LanguageLevel.SPECIALIST]: { emoji: '🌳', label: t('Esperto') },
  };
}
