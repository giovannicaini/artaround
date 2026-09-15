/*
 * File: /src/utils/audio-playback.ts                                                    *
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

import { BCP47_BY_LANGUAGE, type AppLanguage, type GeneratedAudio } from '@artaround/shared';
import { i18nService } from '../services/i18n.service';
import { uploadService } from '../services/upload.service';

/**
 * Riproduzione dell'audio di un item, caricato o generato, con la sintesi vocale del browser come riserva.
 */
let currentAudioEl: HTMLAudioElement | null = null;

// Ferma qualunque riproduzione in corso (file audio o sintesi vocale) — un solo audio alla volta.
export function stopItemAudio(): void {
  currentAudioEl?.pause();
  currentAudioEl = null;
  window.speechSynthesis?.cancel();
}

// Riproduce l'audio caricato/generato di un item nella lingua corrente dell'interfaccia (o in quella sorgente come riserva) se…
export function playItemAudio(
  audio: Partial<Record<AppLanguage, GeneratedAudio>> | undefined,
  sourceLanguage: AppLanguage,
  text: string,
  onEnd: () => void,
): void {
  stopItemAudio();
  const lang = i18nService.getLanguage();
  const generated = audio?.[lang] ?? audio?.[sourceLanguage];

  if (generated) {
    const el = new Audio(uploadService.getImageUrl(generated.url));
    el.onended = onEnd;
    el.onerror = onEnd;
    currentAudioEl = el;
    void el.play();
    return;
  }

  if (!window.speechSynthesis || !text.trim()) {
    onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = BCP47_BY_LANGUAGE[lang];
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}
