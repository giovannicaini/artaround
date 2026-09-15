/*
 * File: /src/services/translation.service.ts                                            *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 26/02/2026                                                             *
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

import { apiService, getErrorMessage } from './api.service';
import type { AppLanguage } from '@artaround/shared';

type BatchTranslationInput = {
  key: string;
  text: string;
  targetLang: AppLanguage;
};

/**
 * Traduzione automatica con AI di titoli/testi nelle lingue attive di un museo.
 */
class TranslationService {
  async translateText(
    text: string,
    sourceLang: AppLanguage,
    targetLang: AppLanguage,
  ): Promise<string> {
    const response = await apiService.post<{ translatedText: string }>('/utils/translate', {
      text,
      sourceLang,
      targetLang,
    });

    if (!response.success || !response.data?.translatedText) {
      throw new Error(getErrorMessage(response, 'Traduzione non disponibile'));
    }

    return response.data.translatedText;
  }

  async translateBatch(
    sourceLang: AppLanguage,
    items: BatchTranslationInput[],
  ): Promise<Record<string, string>> {
    const response = await apiService.post<{ translations: Record<string, string> }>(
      '/utils/translate-batch',
      {
        sourceLang,
        items,
      },
    );

    if (!response.success || !response.data?.translations) {
      throw new Error(getErrorMessage(response, 'Traduzione batch non disponibile'));
    }

    return response.data.translations;
  }
}

export const translationService = new TranslationService();
