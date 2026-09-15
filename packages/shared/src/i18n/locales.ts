/*
 * File: /src/i18n/locales.ts                                                            *
 * Project: @artaround/shared                                                            *
 * Last Modified: 28/02/2026                                                             *
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
 * Carica i dizionari di traduzione (locales/*.json) e le funzioni per interrogarli.
 */
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
