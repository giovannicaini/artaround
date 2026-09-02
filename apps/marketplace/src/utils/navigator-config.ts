import type { AppLanguage } from '@artaround/shared';
import { isLanguageFullyTranslated } from './translation-fields';

// forma "piatta" di NavigatorAppConfig per i form di editing (traduzioni come
// proprietà dirette invece che annidate come nello schema server), condivisa
// tra museums-management-page.ts e navigator-default-config-page.ts
export interface NavigatorConfigFormData {
  id: string;
  name: string;
  slug: string;
  logo: string;
  splashImage: string;
  primaryColor: string;
  secondaryColor: string;
  homeTitle: string;
  homeTitleTranslations: Partial<Record<AppLanguage, string>>;
  homeSubtitle: string;
  homeSubtitleTranslations: Partial<Record<AppLanguage, string>>;
  welcomeText: string;
  welcomeTextTranslations: Partial<Record<AppLanguage, string>>;
  openingImage: string;
  manifestName: string;
  shortName: string;
  manifestDescription: string;
  manifestDescriptionTranslations: Partial<Record<AppLanguage, string>>;
  themeColor: string;
  backgroundColor: string;
  display: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  orientation: 'any' | 'natural' | 'landscape' | 'portrait';
  startUrl: string;
  scope: string;
  icon192: string;
  icon512: string;
  iconMaskable: string;
  appleTouchIcon: string;
}

export type NavigatorColorFieldKey =
  | 'primaryColor'
  | 'secondaryColor'
  | 'themeColor'
  | 'backgroundColor';

export type NavigatorTranslationFieldKey =
  | 'homeTitleTranslations'
  | 'homeSubtitleTranslations'
  | 'welcomeTextTranslations'
  | 'manifestDescriptionTranslations';

export const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeHexColor(value: string, fallback = '#000000'): string {
  const normalized = value.trim();
  return HEX_COLOR_REGEX.test(normalized) ? normalized : fallback;
}

export function isNavigatorConfigLanguageFullyTranslated(
  config: NavigatorConfigFormData,
  language: AppLanguage,
): boolean {
  const fields = [
    { source: config.homeTitle, translations: config.homeTitleTranslations },
    { source: config.homeSubtitle, translations: config.homeSubtitleTranslations },
    { source: config.welcomeText, translations: config.welcomeTextTranslations },
    { source: config.manifestDescription, translations: config.manifestDescriptionTranslations },
  ];

  return isLanguageFullyTranslated(fields, language);
}

export function updateNavigatorConfigTranslationField(
  configs: NavigatorConfigFormData[],
  configId: string,
  fieldKey: NavigatorTranslationFieldKey,
  language: AppLanguage,
  value: string,
): NavigatorConfigFormData[] {
  return configs.map((config) => {
    if (config.id !== configId) {
      return config;
    }

    return {
      ...config,
      [fieldKey]: {
        ...(config[fieldKey] || {}),
        [language]: value,
      },
    };
  });
}
