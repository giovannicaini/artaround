/*
 * File: audioPlayback.ts                                                                *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
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

import type { AudioWordTiming, GeneratedAudio } from '@artaround/shared';

/**
 * Riproduce un MP3 con i timing delle parole e chiama callback (onBoundary, onEnd) per
 * evidenziare il testo sincronizzato durante la riproduzione. Usa un loop basato su
 * requestAnimationFrame (RAF): ad ogni frame legge audio.currentTime + LEAD_SECONDS,
 * trova la parola corrente con wordAt() e invoca onBoundary con l'indice carattere.
 */
class AudioPlaybackService {
  // Anticipa l'evidenziazione di poco per essere più user friendly
  private static readonly LEAD_SECONDS = 0.15;

  private audio: HTMLAudioElement | null = null;
  private words: AudioWordTiming[] = [];
  private onBoundaryCallback: ((charIndex: number) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private rafId: number | null = null;

  // Loop per-frame, con RAF
  private tick = (): void => {
    if (!this.audio || !this.onBoundaryCallback || this.words.length === 0) return;
    this.onBoundaryCallback(
      this.wordAt(this.audio.currentTime + AudioPlaybackService.LEAD_SECONDS).charIndex,
    );
    this.rafId = requestAnimationFrame(this.tick);
  };

  private startTicking(): void {
    this.stopTicking();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopTicking(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private handleEnded = (): void => {
    this.stopTicking();
    this.onEndCallback?.();
  };

  // Ultima parola con start <= t (words è già ordinato per start).
  private wordAt(t: number): AudioWordTiming {
    let current = this.words[0];
    for (const word of this.words) {
      if (word.start > t) break;
      current = word;
    }
    return current;
  }

  // Crea il nuovo <audio> se non è già esistente.
  private ensureElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.addEventListener('ended', this.handleEnded);
    }
    return this.audio;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
  }

  play(
    audio: GeneratedAudio,
    options?: { onBoundary?: (charIndex: number) => void; onEnd?: () => void },
  ): void {
    const el = this.ensureElement();
    if (!el) return;

    this.stop(); // ferma un'eventuale riproduzione precedente prima di caricare la nuova sorgente

    this.words = audio.words;
    this.onBoundaryCallback = options?.onBoundary ?? null;
    this.onEndCallback = options?.onEnd ?? null;
    el.src = audio.url;
    void el.play();
    this.startTicking();
  }

  // Pausa reale (<audio>.pause()): la posizione resta dov'era, resume() la riprende da lì.
  pause(): void {
    this.audio?.pause();
    this.stopTicking();
  }

  resume(): void {
    void this.audio?.play();
    this.startTicking();
  }

  stop(): void {
    this.stopTicking();
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  isPlaying(): boolean {
    return !!this.audio && !this.audio.paused && !this.audio.ended;
  }
}

export const audioPlaybackService = new AudioPlaybackService();
