import type { AudioWordTiming, GeneratedAudio } from '@artaround/shared';

/**
 * Riproduce l'audio già generato (con i timing delle parole) tramite un unico
 * elemento <audio> nascosto, riusato per ogni riproduzione — alternativa a
 * services/speech.ts (Web Speech) con pausa/ripresa native.
 */
class AudioPlaybackService {
  // Anticipa l'evidenziazione di poco: più naturale da seguire a occhio.
  private static readonly LEAD_SECONDS = 0.15;

  private audio: HTMLAudioElement | null = null;
  private words: AudioWordTiming[] = [];
  private onBoundaryCallback: ((charIndex: number) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private rafId: number | null = null;

  // Loop per-frame, non 'timeupdate' (troppo poco frequente per seguire bene le parole).
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
