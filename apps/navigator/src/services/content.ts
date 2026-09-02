import { LanguageLevel, ContentDuration, type AppLanguage, type Item } from '@artaround/shared';
import type { PlayerStep } from '../context/visitSessionStore';

// sceglie l'item più vicino alle preferenze correnti, tra quelli disponibili per una tappa
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

function localizedItemText(item: Item, language: AppLanguage): string {
  if (language === item.sourceLanguage) return item.text;
  return item.translatedTexts?.[language] || item.text;
}

// tappe logistiche/di navigazione sono testo del curatore, senza traduzione nel modello dati
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
