/*
 * File: /src/services/audioPlayback.ts                                                  *
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

// Stessa chiave usata dal Chip "Velocità lettura" nelle impostazioni della visita.
const PLAYBACK_RATE_KEY = 'audioPlaybackRate';

// Valori selezionabili dal Chip delle impostazioni e passi dei comandi vocali "più veloce"/"più lento".
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75];

export function loadStoredPlaybackRate(): number {
  try {
    const saved = Number(localStorage.getItem(PLAYBACK_RATE_KEY));
    if (saved && saved > 0) return saved;
  } catch {
    // storage non disponibile: si resta sul default
  }
  return 1;
}

export function storePlaybackRate(rate: number): void {
  try {
    localStorage.setItem(PLAYBACK_RATE_KEY, String(rate));
  } catch {
    // ignorato
  }
}

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
  // I timing delle parole (words[].start/end) sono calcolati a velocità 1x:
  // il RAF loop li confronta con currentTime, che avanza già più veloce/lento
  // da solo quando playbackRate cambia — non serve altro per restare sincronizzati.
  private playbackRate = loadStoredPlaybackRate();

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
      this.audio.playbackRate = this.playbackRate;
      this.audio.addEventListener('ended', this.handleEnded);
    }
    return this.audio;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && typeof Audio !== 'undefined';
  }

  getPlaybackRate(): number {
    return this.playbackRate;
  }

  // Si applica subito all'audio in corso (se c'è) e resta valida per le prossime riproduzioni.
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    storePlaybackRate(rate);
    if (this.audio) this.audio.playbackRate = rate;
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
    // Cambiare src resetta playbackRate a 1 in alcuni browser: va riapplicata ad ogni riproduzione, non solo alla creazione dell'elemento.
    el.playbackRate = this.playbackRate;
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
