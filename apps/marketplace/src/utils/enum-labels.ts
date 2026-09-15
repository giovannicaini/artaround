/*
 * File: /src/utils/enum-labels.ts                                                       *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import {
  getReferenceTypeLabel as getReferenceTypeLabelIt,
  getContentDurationLabel as getContentDurationLabelIt,
  getLanguageLevelLabel as getLanguageLevelLabelIt,
  getLicenseLabel as getLicenseLabelIt,
  ITEM_REFERENCE_TYPE_OPTIONS_IT,
  CONTENT_DURATION_OPTIONS_IT,
  LANGUAGE_LEVEL_OPTIONS_IT,
  LICENSE_TYPE_OPTIONS_IT,
  type ItemReferenceType,
  type ContentDuration,
  type LanguageLevel,
  type LicenseType,
} from '@artaround/shared';
import { __ } from '../services/i18n.service';

/**
 * Etichette ed opzioni per gli enum condivisi (tipo riferimento, durata, livello, licenza),
 * sempre passate da __() perché @artaround/shared le espone fisse in italiano.
 */
export function getReferenceTypeLabel(type: ItemReferenceType | string): string {
  return __(getReferenceTypeLabelIt(type));
}

export function getContentDurationLabel(duration: ContentDuration | string): string {
  return __(getContentDurationLabelIt(duration));
}

export function getLanguageLevelLabel(level: LanguageLevel | string): string {
  return __(getLanguageLevelLabelIt(level));
}

export function getLicenseLabel(license: LicenseType | string): string {
  return __(getLicenseLabelIt(license));
}

export function getReferenceTypeOptions() {
  return ITEM_REFERENCE_TYPE_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}

export function getContentDurationOptions() {
  return CONTENT_DURATION_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}

export function getLanguageLevelOptions() {
  return LANGUAGE_LEVEL_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}

export function getLicenseTypeOptions() {
  return LICENSE_TYPE_OPTIONS_IT.map((option) => ({ ...option, label: __(option.label) }));
}
