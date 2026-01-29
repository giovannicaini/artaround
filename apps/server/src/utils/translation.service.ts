import axios from 'axios';
import { config } from '../config/config';

export class TranslationService {
  // Translate text using OpenAI or Claude
  static async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    try {
      // Try OpenAI first
      if (config.ai.openaiApiKey) {
        return await this.translateWithOpenAI(text, sourceLang, targetLang);
      }
      
      // Fallback to Claude
      if (config.ai.anthropicApiKey) {
        return await this.translateWithClaude(text, sourceLang, targetLang);
      }

      throw new Error('No AI API key configured');
    } catch (error) {
      console.error('Translation error:', error);
      throw error;
    }
  }

  private static async translateWithOpenAI(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate from ${sourceLang} to ${targetLang}. Preserve the tone and style. Return only the translation without any explanation.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.openaiApiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  }

  private static async translateWithClaude(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `Translate the following text from ${sourceLang} to ${targetLang}. Preserve the tone and style. Return only the translation without any explanation:\n\n${text}`,
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          'x-api-key': config.ai.anthropicApiKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.content[0].text.trim();
  }

  // Batch translate multiple texts
  static async batchTranslate(
    texts: string[],
    sourceLang: string,
    targetLang: string
  ): Promise<string[]> {
    const promises = texts.map(text => this.translate(text, sourceLang, targetLang));
    return await Promise.all(promises);
  }
}
