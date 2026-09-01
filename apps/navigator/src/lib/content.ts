import { LanguageLevel, ContentDuration, type AppLanguage, type Item } from '@artaround/shared';
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

/** Testo di un Item nella lingua corrente, con l'italiano/originale come riserva. */
function localizedItemText(item: Item, language: AppLanguage): string {
  if (language === item.sourceLanguage) return item.text;
  return item.translatedTexts?.[language] || item.text;
}

/**
 * Il testo da leggere/mostrare per la tappa corrente, qualunque sia il suo
 * tipo — un solo punto che conosce come estrarlo da ognuno dei tre casi, e
 * nella lingua scelta dall'utente quando l'item ha una traduzione.
 * Le tappe logistiche/di navigazione sono testo scritto direttamente dal
 * curatore per quella visita (non un Item riusabile) e oggi non hanno un
 * campo di traduzione nel modello dati: restano nella lingua originale.
 */
export function getStepText(
  step: PlayerStep,
  languageLevel: LanguageLevel,
  contentDuration: ContentDuration,
  language: AppLanguage,
): string {
  switch (step.kind) {
    case 'artwork': {
      const item = pickItemForPreferences(step.items, languageLevel, contentDuration);
      return item ? localizedItemText(item, language) : '';
    }
    case 'logistic':
      return step.text;
    case 'navigation':
      return step.text;
  }
}
