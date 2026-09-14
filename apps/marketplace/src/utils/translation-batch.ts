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
