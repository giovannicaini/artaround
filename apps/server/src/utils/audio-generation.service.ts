import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import type { AppLanguage, AudioWordTiming, GeneratedAudio } from '@artaround/shared';
import { AIService, type TranscribedWord } from './ai.service.js';
import { UploadService } from './upload.service.js';

const AUDIO_DIR = 'audio';

// Voce fissa per ogni lingua — scelta dopo un confronto d'ascolto diretto
// con il curatore (vedi TTS_INSTRUCTIONS per il perché delle istruzioni).
const TTS_VOICE = 'cedar';

// Un orario "in punto" scritto HH:00 (es. "17:00") va letto come "le 17",
// non parola per parola ("diciassette zero zero") — il modello non lo fa
// da solo nemmeno con le istruzioni sotto, va corretto nel testo prima
// di mandarlo in sintesi.
function normalizeTimesForSpeech(text: string): string {
  return text.replace(/\b(\d{1,2}):00\b/g, '$1');
}

// gpt-4o-mini-tts (a differenza di tts-1) accetta "instructions" per guidare
// accento e pronuncia — senza, tende a un accento americanizzato anche su
// testo scritto in un'altra lingua. Una per lingua supportata (vedi AppLanguage).
const TTS_INSTRUCTIONS: Record<AppLanguage, string> = {
  it: 'Parla in italiano, con accento e prosodia italiani naturali (non americano). Leggi numeri, date, orari e valute per esteso in italiano, come farebbe una guida museale italiana.',
  en: 'Speak in natural, fluent English, as a museum guide would. Read numbers, dates, times and currency amounts the way a native speaker naturally would.',
  fr: 'Parle en français, avec un accent et une prosodie français naturels. Lis les nombres, dates, heures et montants comme le ferait un guide de musée francophone.',
  de: 'Sprich auf Deutsch, mit natürlichem deutschen Akzent und Sprachrhythmus. Lies Zahlen, Daten, Uhrzeiten und Beträge so, wie es eine deutschsprachige Museumsführung tun würde.',
  es: 'Habla en español, con acento y prosodia españoles naturales. Lee números, fechas, horas e importes como lo haría un guía de museo hispanohablante.',
};

/**
 * Trova, per ogni parola trascritta, la sua posizione (charIndex) nel testo
 * originale — cercando in avanti dall'ultimo punto trovato, senza tornare
 * mai indietro, così l'ordine delle parole guida la ricerca invece di
 * confondersi con ripetizioni della stessa parola altrove nel testo. Una
 * parola trascritta che non si trova (differenze di punteggiatura/normalizzazione
 * tra ciò che OpenAI trascrive e il testo scritto dal curatore) viene
 * semplicemente scartata: non deve mai far fallire l'intera generazione per
 * un disallineamento minore.
 */
function alignWordsToText(text: string, words: TranscribedWord[]): AudioWordTiming[] {
  const lowerText = text.toLowerCase();
  const aligned: AudioWordTiming[] = [];
  let searchFrom = 0;

  for (const word of words) {
    const needle = word.word.trim().toLowerCase();
    if (!needle) continue;

    const charIndex = lowerText.indexOf(needle, searchFrom);
    if (charIndex === -1) continue;

    aligned.push({ word: word.word, start: word.start, end: word.end, charIndex });
    searchFrom = charIndex + needle.length;
  }

  return aligned;
}

/**
 * Genera l'audio (OpenAI TTS) di un testo in una lingua, lo salva su disco
 * e lo trascrive per ricavare i tempi delle singole parole — allineati al
 * testo una sola volta qui, non ad ogni ascolto (vedi AudioWordTiming).
 * Chiamata dai due sync in museum.controller.ts (item/tappe di visita), mai
 * automaticamente: è un'azione esplicita per il costo/tempo che comporta.
 */
export async function generateAudioForText(
  text: string,
  language: AppLanguage,
): Promise<GeneratedAudio> {
  const speechText = normalizeTimesForSpeech(text);
  const audioBuffer = await AIService.createSpeech(speechText, {
    model: 'gpt-4o-mini-tts',
    voice: TTS_VOICE,
    instructions: TTS_INSTRUCTIONS[language],
  });

  const audioDir = path.join(UploadService.getUploadsDir(), AUDIO_DIR);
  await fs.mkdir(audioDir, { recursive: true });
  const filename = `${crypto.randomBytes(12).toString('hex')}.mp3`;
  await fs.writeFile(path.join(audioDir, filename), audioBuffer);

  // La trascrizione (per i tempi delle parole) deve allinearsi al testo
  // originale scritto dal curatore, non a quello normalizzato per la voce.
  const transcribedWords = await AIService.transcribeWordTimestamps(audioBuffer, language);
  const words = alignWordsToText(text, transcribedWords);

  return { url: `/uploads/${AUDIO_DIR}/${filename}`, words, source: 'ai' };
}

/** Elimina il file audio su disco di una GeneratedAudio, se presente — usata
 * quando il testo che descriveva cambia e l'audio generato non è più valido. */
export async function deleteGeneratedAudioFile(audio: GeneratedAudio | undefined): Promise<void> {
  if (audio?.url) {
    await UploadService.deleteFile(audio.url);
  }
}

/**
 * Salva su disco un file audio caricato a mano da un autore (nessuna sintesi
 * OpenAI, quindi nessuna trascrizione/allineamento parole — `words` resta
 * vuoto, il Navigator mostra il testo senza evidenziazione parola-per-parola
 * per questa lingua). Stessa cartella usata da generateAudioForText; `source`
 * distingue le due provenienze per l'interfaccia (vedi item-audio-panel.ts),
 * ma per chi ascolta il file è identico.
 */
export async function saveUploadedAudioFile(
  buffer: Buffer,
  originalName: string,
): Promise<GeneratedAudio> {
  const audioDir = path.join(UploadService.getUploadsDir(), AUDIO_DIR);
  await fs.mkdir(audioDir, { recursive: true });
  const ext = path.extname(originalName).toLowerCase() || '.mp3';
  const filename = `${crypto.randomBytes(12).toString('hex')}${ext}`;
  await fs.writeFile(path.join(audioDir, filename), buffer);

  return { url: `/uploads/${AUDIO_DIR}/${filename}`, words: [], source: 'manual' };
}
