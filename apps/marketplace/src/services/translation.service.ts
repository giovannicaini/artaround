import { apiService, getErrorMessage } from './api.service';
import type { AppLanguage } from '@artaround/shared';

type BatchTranslationInput = {
  key: string;
  text: string;
  targetLang: AppLanguage;
};

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
