// Speech synthesis service
class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private onEndCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
    }
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  speak(text: string, options?: { rate?: number; pitch?: number; lang?: string }): void {
    if (!this.synth) return;

    // Cancel any ongoing speech
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

    this.utterance.onend = () => {
      this.onEndCallback?.();
    };

    this.synth.speak(this.utterance);
  }

  stop(): void {
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

// Speech Recognition types (not fully supported in all browsers)
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

// Command parser for voice commands — vocabolario allineato 1:1 alla lista
// di specifica ("prossimo, precedente, Cos'è questo, dimmi di più, dimmi
// di meno, Non capisco, troppo semplice, Chi è l'autore, qual è lo stile,
// Dov'è l'uscita/toilette/bar/shop, ci sono ostacoli").
export function parseVoiceCommand(text: string): string | null {
  const commands: Record<string, string[]> = {
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

  for (const [command, patterns] of Object.entries(commands)) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        return command;
      }
    }
  }

  return null;
}
