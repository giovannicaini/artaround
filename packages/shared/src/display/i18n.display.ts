/*
 * File: /src/display/i18n.display.ts                                                    *
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
 * Metadati (etichetta, bandiera) delle lingue supportate dall'app, per i selettori lingua.
 */
import { AppLanguage, SUPPORTED_APP_LANGUAGES } from '../types/i18n.types';

export const APP_LANGUAGE_META: Readonly<Record<AppLanguage, { label: string; flagCode: string }>> =
  {
    it: { label: 'Italiano', flagCode: 'it' },
    en: { label: 'English', flagCode: 'us' },
    fr: { label: 'Français', flagCode: 'fr' },
    de: { label: 'Deutsch', flagCode: 'de' },
    es: { label: 'Español', flagCode: 'es' },
  };

export const APP_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: AppLanguage;
  label: string;
  flagCode: string;
}> = SUPPORTED_APP_LANGUAGES.map((value) => ({ value, ...APP_LANGUAGE_META[value] }));
