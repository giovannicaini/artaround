/*
 * File: speech.ts                                                                       *
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

/**
 * Servizio per TTS (se non presente MP3) e riconoscimento vocale usato dal player.
 */
import type { VoiceCommandId } from '@artaround/shared';

// Caratteri al secondo stimati per l'italiano letto a velocità normale
const ESTIMATED_CHARS_PER_SECOND = 15;

// Speech synthesis service
class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private onEndCallback: (() => void) | null = null;
  private estimatedHighlightStartTimeout: number | null = null;
  private estimatedHighlightInterval: number | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  speak(
    text: string,
    options?: {
      rate?: number;
      pitch?: number;
      lang?: string;
      // onboundary nativo: su molti Chrome Android non arriva mai (bug noto
      // della piattaforma) — se non arriva in tempo si stima a tempo, vedi sotto.
      onBoundary?: (charIndex: number) => void;
    },
  ): void {
    if (!this.synth) return;

    // Prima di iniziare cancella eventuali play precedenti
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.rate = options?.rate || 1;
    this.utterance.pitch = options?.pitch || 1;
    this.utterance.lang = options?.lang || 'it-IT';

    // Try to find an Italian voice
    const voices = this.synth.getVoices();
    const italianVoice = voices.find((v) => v.lang.startsWith('it'));
    if (italianVoice) {
      this.utterance.voice = italianVoice;
    }

    let realBoundaryReceived = false;

    // Non aspetta onstart per armare il fallback: su Android non è affidabile neanche quello.
    if (options?.onBoundary) {
      this.estimatedHighlightStartTimeout = window.setTimeout(() => {
        if (!realBoundaryReceived) {
          this.startEstimatedHighlight(text, this.utterance!.rate, options.onBoundary!);
        }
      }, 500);
    }

    this.utterance.onend = () => {
      this.clearEstimatedHighlight();
      this.onEndCallback?.();
    };

    this.utterance.onboundary = (event) => {
      realBoundaryReceived = true;
      this.clearEstimatedHighlight();
      options?.onBoundary?.(event.charIndex);
    };

    this.synth.speak(this.utterance);
  }

  // Fallback per i motori TTS senza onboundary: avanza l'evidenziazione a
  // tempo, stimando la durata dal numero di caratteri — approssimativo ma meglio di niente.
  private startEstimatedHighlight(
    text: string,
    rate: number,
    onBoundary: (charIndex: number) => void,
  ): void {
    const estimatedDurationMs = (text.length / ESTIMATED_CHARS_PER_SECOND / rate) * 1000;
    const startTime = Date.now();

    this.estimatedHighlightInterval = window.setInterval(() => {
      const progress = Math.min(1, (Date.now() - startTime) / estimatedDurationMs);
      onBoundary(Math.floor(progress * text.length));
      if (progress >= 1) this.clearEstimatedHighlight();
    }, 50);
  }

  private clearEstimatedHighlight(): void {
    if (this.estimatedHighlightStartTimeout !== null) {
      clearTimeout(this.estimatedHighlightStartTimeout);
      this.estimatedHighlightStartTimeout = null;
    }
    if (this.estimatedHighlightInterval !== null) {
      clearInterval(this.estimatedHighlightInterval);
      this.estimatedHighlightInterval = null;
    }
  }

  stop(): void {
    this.clearEstimatedHighlight();
    if (this.synth) {
      this.synth.cancel();
    }
  }

  pause(): void {
    if (this.synth) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth) {
      this.synth.resume();
    }
  }

  isSpeaking(): boolean {
    return this.synth?.speaking || false;
  }

  isPaused(): boolean {
    return this.synth?.paused || false;
  }

  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }
}

export const speechService = new SpeechService();

// Tipi per il riconoscimento vocale (non supportato in tutti i browser)
interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

// Voice recognition service
class VoiceRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (
          window as Window & {
            SpeechRecognition?: new () => SpeechRecognitionInstance;
            webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
          }
        ).SpeechRecognition ||
        (window as Window & { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
          .webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'it-IT';
      }
    }
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  setLanguage(lang: string): void {
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  start(onResult: (text: string) => void, onEnd?: () => void): void {
    if (!this.recognition || this.isListening) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      onResult(transcript);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd?.();
    };

    this.recognition.onerror = () => {
      this.isListening = false;
      onEnd?.();
    };

    this.isListening = true;
    this.recognition.start();
  }

  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}

export const voiceRecognitionService = new VoiceRecognitionService();

// Match locale a pattern fissi, un tentativo per ogni ID di VOICE_COMMAND_IDS
// prima di ricorrere al fallback AI (vedi apiClient.classifyVoiceCommand).
export function parseVoiceCommand(text: string): VoiceCommandId | null {
  const commands: Record<VoiceCommandId, string[]> = {
    next: ['prossimo', 'avanti', 'successivo', 'vai avanti', 'next'],
    prev: ['precedente', 'indietro', 'torna indietro', 'previous', 'back'],
    play: ['leggi', 'ascolta', 'play', 'parla'],
    stop: ['stop', 'ferma', 'basta', 'silenzio'],
    whatIsThis: ['cos è questo', "cos'è questo", 'cosa sto guardando', 'cosa vedo'],
    more: ['dimmi di più', 'più dettagli', 'approfondisci', 'more'],
    less: ['dimmi di meno', 'più breve', 'riassumi', 'less'],
    tooHard: ['non capisco', 'troppo difficile', 'troppo complicato'],
    tooSimple: ['troppo semplice', 'so già questo', 'lo sapevo già'],
    author: ["chi è l'autore", 'chi ha fatto', 'chi lo ha dipinto', 'chi lo ha scolpito'],
    style: ['qual è lo stile', 'che stile è', 'che corrente è', 'che movimento è'],
    repeat: ['ripeti', 'ancora', 'di nuovo', 'repeat'],
    exit: ["dov'è l'uscita", 'uscita', 'esci', 'exit'],
    toilette: ["dov'è il bagno", "dov'è la toilette", 'toilette', 'bagno', 'wc'],
    bar: ["dov'è il bar", 'bar', 'caffè'],
    shop: ["dov'è lo shop", "dov'è il negozio", 'shop', 'negozio', 'souvenir'],
    obstacles: ['ci sono ostacoli', "c'è un ostacolo", 'è accessibile', 'ostacoli'],
    help: ['aiuto', 'help', 'cosa posso dire'],
  };

  for (const command of Object.keys(commands) as VoiceCommandId[]) {
    for (const pattern of commands[command]) {
      if (text.includes(pattern)) {
        return command;
      }
    }
  }

  return null;
}
