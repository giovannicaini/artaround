import { LanguageLevel, ContentDuration, type Item } from '@artaround/shared';
import type { PlayerStep } from '../stores/visitSessionStore';

/**
 * Sceglie, tra gli Item disponibili per una tappa, quello più vicino alle
 * preferenze correnti. Stessa logica in un solo posto invece che duplicata
 * ovunque serva "qual è il testo da leggere ora".
 */
export function pickItemForPreferences(
  items: Item[],
  languageLevel: LanguageLevel,
  contentDuration: ContentDuration,
): Item | null {
  if (items.length === 0) return null;

  const exact = items.find(
    (item) => item.languageLevel === languageLevel && item.duration === contentDuration,
  );
  if (exact) return exact;

  const byDuration = items.find((item) => item.duration === contentDuration);
  if (byDuration) return byDuration;

  const byLevel = items.find((item) => item.languageLevel === languageLevel);
  if (byLevel) return byLevel;

  return items[0];
}

/**
 * Il testo da leggere/mostrare per la tappa corrente, qualunque sia il suo
 * tipo — un solo punto che conosce come estrarlo da ognuno dei tre casi.
 */
export function getStepText(
  step: PlayerStep,
  languageLevel: LanguageLevel,
  contentDuration: ContentDuration,
): string {
  switch (step.kind) {
    case 'artwork':
      return pickItemForPreferences(step.items, languageLevel, contentDuration)?.text || '';
    case 'logistic':
      return step.text;
    case 'navigation':
      return step.text;
  }
}
