export type LanguageCode = string;

export type TranslationMap<TLanguage extends LanguageCode = LanguageCode> = Partial<
  Record<TLanguage, string>
>;

export type TranslatableField<TLanguage extends LanguageCode = LanguageCode> = {
  source: string;
  translations: TranslationMap<TLanguage>;
};

export function isLanguageFullyTranslated<TLanguage extends LanguageCode>(
  fields: Array<TranslatableField<TLanguage>>,
  language: TLanguage,
): boolean {
  const hasAnyTranslationValue = fields.some((field) =>
    Boolean(String(field.translations[language] || '').trim()),
  );

  if (!hasAnyTranslationValue) {
    return false;
  }

  return fields.every((field) => {
    const sourceValue = String(field.source || '').trim();
    const translatedValue = String(field.translations[language] || '').trim();

    if (!sourceValue) {
      return true;
    }

    return Boolean(translatedValue);
  });
}

export function buildTranslationLanguageOptions<TLanguage extends LanguageCode>(
  languages: TLanguage[],
  getLanguageLabel: (language: TLanguage) => string,
  isTranslated: (language: TLanguage) => boolean,
  labels: {
    translated: string;
    toTranslate: string;
  },
): Array<{ value: TLanguage; label: string }> {
  return languages.map((language) => {
    const languageLabel = getLanguageLabel(language);
    const statusLabel = isTranslated(language) ? labels.translated : labels.toTranslate;

    return {
      value: language,
      label: `${languageLabel} • ${statusLabel}`,
    };
  });
}
