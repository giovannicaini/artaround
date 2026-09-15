/*
 * File: /src/utils/translation.service.ts                                               *
 * Project: @artaround/server                                                            *
 * Last Modified: 02/09/2026                                                             *
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
 * Traduzione dei contenuti via OpenAI, singola o in batch, usata dai pulsanti "Traduci con AI" e dagli script di sincronizzazione lingue.
 */
import { AIService } from './ai.service.js';

type BatchTranslationInput = {
  key: string;
  text: string;
  targetLang: string;
};

type BatchTranslationOutput = {
  translations: Array<{
    key: string;
    translatedText: string;
  }>;
};

export class TranslationService {
  // Traduce il testo usando solo OpenAI
  static async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    try {
      return await AIService.createChatCompletion(
        [
          {
            role: 'system',
            content: `You are a professional translator. Translate from ${sourceLang} to ${targetLang}. Preserve the tone and style. Return only the translation without any explanation.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI translation failed: ${message}`);
    }
  }

  // Traduce più testi in blocco
  static async batchTranslate(
    sourceLang: string,
    items: BatchTranslationInput[],
  ): Promise<Record<string, string>> {
    if (items.length === 0) {
      return {};
    }

    try {
      const result = await AIService.generateJson<BatchTranslationOutput>(
        `You are a professional translator.
Translate each item from ${sourceLang} to the targetLang specified in each item.
Preserve tone and style.
Return only JSON with this exact schema:
{ "translations": [{ "key": "string", "translatedText": "string" }] }
Keep exactly one output entry for each input key.`,
        JSON.stringify({ items }),
        {
          model: 'gpt-4o-mini',
          temperature: 0.2,
        },
      );

      const translationMap: Record<string, string> = {};
      for (const entry of result.translations || []) {
        if (entry?.key && typeof entry.translatedText === 'string') {
          translationMap[entry.key] = entry.translatedText.trim();
        }
      }

      for (const item of items) {
        if (!translationMap[item.key]) {
          throw new Error(`Missing translation for key: ${item.key}`);
        }
      }

      return translationMap;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI batch translation failed: ${message}`);
    }
  }
}
