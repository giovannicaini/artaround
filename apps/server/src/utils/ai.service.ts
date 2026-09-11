import axios from 'axios';
import { config } from '../config/config.js';

export type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

type GenerateJsonOptions = ChatCompletionOptions;

export type TranscribedWord = { word: string; start: number; end: number };

export class AIService {
  private static readonly DEFAULT_MODEL = 'gpt-4o-mini';
  private static readonly TTS_MODEL = 'tts-1';
  private static readonly TRANSCRIPTION_MODEL = 'whisper-1';

  static hasValidOpenAIKey(): boolean {
    return this.isUsableApiKey(config.ai.openaiApiKey);
  }

  static assertConfigured(): void {
    if (!this.hasValidOpenAIKey()) {
      throw new Error('OpenAI API key non configurata o non valida');
    }
  }

  static async createChatCompletion(
    messages: OpenAIChatMessage[],
    options: ChatCompletionOptions = {},
  ): Promise<string> {
    this.assertConfigured();

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: options.model || this.DEFAULT_MODEL,
          messages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${config.ai.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenAI response vuota o non valida');
      }

      return content.trim();
    } catch (error) {
      throw new Error(this.formatOpenAIError(error));
    }
  }

  static async generateJson<T>(
    systemInstruction: string,
    userPrompt: string,
    options: GenerateJsonOptions = {},
  ): Promise<T> {
    const content = await this.createChatCompletion(
      [
        {
          role: 'system',
          content: `${systemInstruction}\nRespond only with valid JSON. Do not include markdown fences.`,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      options,
    );

    const normalized = content.trim();
    const jsonCandidate = normalized.startsWith('```')
      ? normalized.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
      : normalized;

    try {
      return JSON.parse(jsonCandidate) as T;
    } catch {
      throw new Error('OpenAI ha restituito un JSON non valido');
    }
  }

  // Modello TTS steerable (supporta "instructions", a differenza di tts-1) —
  // usato per accento/prosodia italiani e lettura corretta di numeri/orari,
  // vedi createSpeech.
  private static readonly TTS_STEERABLE_MODEL = 'gpt-4o-mini-tts';

  // Sintesi vocale: genera l'audio (mp3) di un testo. Nessun timing delle
  // parole qui — arriva solo dalla trascrizione qui sotto.
  // `instructions` è supportato solo da TTS_STEERABLE_MODEL: con tts-1/tts-1-hd
  // l'API lo ignora silenziosamente, quindi va passato solo insieme al modello giusto.
  static async createSpeech(
    text: string,
    options: { voice?: string; model?: string; instructions?: string } = {},
  ): Promise<Buffer> {
    this.assertConfigured();

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: options.model || this.TTS_MODEL,
          input: text,
          voice: options.voice || 'alloy',
          response_format: 'mp3',
          ...(options.instructions ? { instructions: options.instructions } : {}),
        },
        {
          headers: { Authorization: `Bearer ${config.ai.openaiApiKey}` },
          responseType: 'arraybuffer',
        },
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      throw new Error(this.formatOpenAIError(error));
    }
  }

  // Trascrive un audio con i tempi di ciascuna parola (per sincronizzare
  // l'evidenziazione del testo con la riproduzione — vedi audio-generation.service.ts,
  // che allinea queste parole al testo originale una sola volta, alla generazione).
  // `language` (codice ISO 639-1, es. 'it') è un suggerimento per Whisper:
  // sappiamo già in che lingua è il testo, non serve fargliela indovinare.
  static async transcribeWordTimestamps(
    audioBuffer: Buffer,
    language?: string,
  ): Promise<TranscribedWord[]> {
    this.assertConfigured();

    try {
      const form = new FormData();
      form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'speech.mp3');
      form.append('model', this.TRANSCRIPTION_MODEL);
      form.append('response_format', 'verbose_json');
      form.append('timestamp_granularities[]', 'word');
      if (language) form.append('language', language);

      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { Authorization: `Bearer ${config.ai.openaiApiKey}` },
      });

      const words = (response.data as { words?: TranscribedWord[] })?.words;
      return Array.isArray(words) ? words : [];
    } catch (error) {
      throw new Error(this.formatOpenAIError(error));
    }
  }

  static async checkOpenAIHealth(): Promise<{ ok: boolean; model: string; error?: string }> {
    const model = this.DEFAULT_MODEL;

    if (!this.hasValidOpenAIKey()) {
      return {
        ok: false,
        model,
        error: 'OpenAI API key non configurata o non valida',
      };
    }

    try {
      await this.createChatCompletion(
        [
          {
            role: 'system',
            content: 'Reply with exactly: OK',
          },
          {
            role: 'user',
            content: 'ping',
          },
        ],
        {
          model,
          temperature: 0,
          maxTokens: 5,
        },
      );

      return { ok: true, model };
    } catch (error) {
      return {
        ok: false,
        model,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private static isUsableApiKey(value: string | undefined): value is string {
    if (!value) return false;
    const normalized = value.trim();
    if (!normalized) return false;

    const lower = normalized.toLowerCase();
    if (lower.includes('your_') || lower.includes('placeholder') || lower.includes('change_me')) {
      return false;
    }

    return true;
  }

  private static formatOpenAIError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const apiMessage =
        (error.response?.data as { error?: { message?: string } })?.error?.message || error.message;

      if (status === 429) {
        return 'OpenAI quota/rate limit raggiunto (429). Verifica billing, crediti e limiti RPM/TPM.';
      }
      if (status === 401) {
        return 'OpenAI API key non valida o scaduta (401).';
      }
      if (status === 403) {
        return 'Accesso OpenAI negato (403). Verifica permessi del progetto/API key.';
      }

      return `OpenAI errore HTTP ${status ?? 'sconosciuto'}: ${apiMessage}`;
    }

    return error instanceof Error ? error.message : String(error);
  }
}
