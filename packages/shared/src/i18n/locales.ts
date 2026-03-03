import type { AppLanguage } from '../types';
import itLocale from '../locales/it.json';
import enLocale from '../locales/en.json';
import frLocale from '../locales/fr.json';
import deLocale from '../locales/de.json';
import esLocale from '../locales/es.json';

export type I18nDictionary = Record<string, string>;

export const localesByLanguage: Record<AppLanguage, I18nDictionary> = {
  it: itLocale as I18nDictionary,
  en: enLocale as I18nDictionary,
  fr: frLocale as I18nDictionary,
  de: deLocale as I18nDictionary,
  es: esLocale as I18nDictionary,
};
