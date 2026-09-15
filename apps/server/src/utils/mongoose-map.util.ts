/*
 * File: /src/utils/mongoose-map.util.ts                                                 *
 * Project: @artaround/server                                                            *
 * Last Modified: 07/09/2026                                                             *
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
 * Normalizza un campo Mongoose Map in un plain object, indipendentemente dal fatto che il documento sia idratato o già in JSON.
 */
// Normalizza un campo Mongoose `{type: Map, of: ...}` (translatedTexts,
// audio, ecc.) in un plain object — a runtime è una vera Map su un documento
// idratato, ma un plain object su uno `.lean()` o già in JSON. Un solo posto
// per questa differenza invece di riscriverla in ogni controller che legge
// uno di questi campi.

export function mapToRecord<T = string>(value: unknown): Record<string, T> {
  if (value instanceof Map) {
    return Object.fromEntries(value.entries()) as Record<string, T>;
  }

  if (value && typeof value === 'object') {
    return { ...(value as Record<string, T>) };
  }

  return {};
}
