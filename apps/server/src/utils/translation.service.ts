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
  // Translate text using OpenAI only
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

  // Batch translate multiple texts
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
