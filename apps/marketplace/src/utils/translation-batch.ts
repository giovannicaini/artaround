/*
 * File: /src/utils/translation-batch.ts                                                 *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import type { AppLanguage } from '@artaround/shared';
import { translationService } from '../services/translation.service';

export interface TranslationBatchField {
  key: string;
  sourceValue: string;
  currentValue: string;
}

export interface RunBatchTranslationOptions {
  sourceLanguage: AppLanguage;
  targetLanguages: AppLanguage[];
  getFields: (lang: AppLanguage) => TranslationBatchField[];
  validationErrorMessage: string;
  onFieldTranslated: (lang: AppLanguage, key: string, value: string) => void;
  onLanguageTranslatedByAI: (lang: AppLanguage) => void;
  onError: (message: string) => void;
  onTranslatingChange: (translating: boolean) => void;
}

/**
 * Traduce con AI i campi mancanti di ogni lingua target, via translationService.translateBatch.
 */
export async function runBatchTranslation(options: RunBatchTranslationOptions): Promise<void> {
  const {
    sourceLanguage,
    targetLanguages,
    getFields,
    validationErrorMessage,
    onFieldTranslated,
    onLanguageTranslatedByAI,
    onError,
    onTranslatingChange,
  } = options;

  const fieldsByLang = new Map<AppLanguage, TranslationBatchField[]>();
  const batchItems: Array<{ key: string; text: string; targetLang: AppLanguage }> = [];

  for (const lang of targetLanguages) {
    const fields = getFields(lang);
    fieldsByLang.set(lang, fields);
    for (const field of fields) {
      if (!field.sourceValue.trim()) {
        onError(validationErrorMessage);
        return;
      }
      if (!field.currentValue?.trim()) {
        batchItems.push({ key: `${lang}:${field.key}`, text: field.sourceValue, targetLang: lang });
      }
    }
  }

  if (batchItems.length === 0) {
    return;
  }

  onTranslatingChange(true);
  onError('');

  try {
    const translations = await translationService.translateBatch(sourceLanguage, batchItems);

    for (const lang of targetLanguages) {
      let translatedByAI = false;
      for (const field of fieldsByLang.get(lang) ?? []) {
        const translated = translations[`${lang}:${field.key}`];
        if (translated) {
          onFieldTranslated(lang, field.key, translated);
          translatedByAI = true;
        }
      }
      if (translatedByAI) {
        onLanguageTranslatedByAI(lang);
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Traduzione automatica non riuscita');
  } finally {
    onTranslatingChange(false);
  }
}
