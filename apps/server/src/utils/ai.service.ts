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

export class AIService {
  private static readonly DEFAULT_MODEL = 'gpt-4o-mini';

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
