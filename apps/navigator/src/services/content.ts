/*
 * File: content.ts                                                                      *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

/**
 * Helpers per la selezione e il recupero di contenuti per le tappe della visita.
 */
import {
  LanguageLevel,
  ContentDuration,
  type AppLanguage,
  type Item,
  type GeneratedAudio,
} from '@artaround/shared';
import type { PlayerStep } from '../context/visitSessionStore';

// Sceglie, tra gli Item disponibili per una tappa, quello più vicino alle preferenze correnti.
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

// Testo di un Item nella lingua corrente, con l'italiano/originale come riserva.
export function localizedItemText(item: Item, language: AppLanguage): string {
  if (language === item.sourceLanguage) return item.text;
  return item.translatedTexts?.[language] || item.text;
}

// Il testo da leggere/mostrare per la tappa corrente, nella lingua scelta dall'utente.
export function getStepText(
  step: PlayerStep,
  languageLevel: LanguageLevel,
  contentDuration: ContentDuration,
  language: AppLanguage,
): string {
  switch (step.kind) {
    case 'artwork':
    case 'content': {
      const item = pickItemForPreferences(step.items, languageLevel, contentDuration);
      return item ? localizedItemText(item, language) : '';
    }
    case 'logistic':
    case 'navigation':
      return step.textTranslations?.[language] || step.text;
  }
}

// L'audio già generato per la tappa corrente, se esiste — stessa risoluzione di getStepText.
export function getStepAudio(
  step: PlayerStep,
  languageLevel: LanguageLevel,
  contentDuration: ContentDuration,
  language: AppLanguage,
): GeneratedAudio | undefined {
  switch (step.kind) {
    case 'artwork':
    case 'content': {
      const item = pickItemForPreferences(step.items, languageLevel, contentDuration);
      return item?.audio?.[language];
    }
    case 'logistic':
    case 'navigation':
      return step.textAudio?.[language];
  }
}

// Titolo di una tappa LOGISTIC nella lingua corrente, con l'originale come riserva.
export function getStepTitle(
  step: Extract<PlayerStep, { kind: 'logistic' }>,
  language: AppLanguage,
): string {
  return step.titleTranslations?.[language] || step.title;
}
