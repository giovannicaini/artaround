/*
 * File: /src/types/i18n.types.ts                                                        *
 * Project: @artaround/shared                                                            *
 * Last Modified: 12/09/2026                                                             *
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
 * Tipi i18n (traduzione)
 *
 * Lingue supportate da Marketplace/Navigator a livello globale (ovvero,
 * usate per tradurre tutte le stringhe "fisse" presenti nell'app).
 * In @shared/src/locales ci sono i json con la traduzione di tali stringhe.
 */

export const SUPPORTED_APP_LANGUAGES = ['it', 'en', 'fr', 'de', 'es'] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'it';

export const isSupportedAppLanguage = (value: string): value is AppLanguage =>
  SUPPORTED_APP_LANGUAGES.includes(value as AppLanguage);

// Codice BCP47 per lingua — usato per la sintesi/riconoscimento vocale
// (SpeechSynthesisUtterance.lang, SpeechRecognition.lang) sia in Marketplace
// che in Navigator.
export const BCP47_BY_LANGUAGE: Record<AppLanguage, string> = {
  it: 'it-IT',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
};
