import { apiService, getErrorMessage } from './api.service';

type AIHealthResponse = {
  ok: boolean;
  model: string;
  error?: string;
};

class AIService {
  async checkHealth(): Promise<{ data: AIHealthResponse | null; error?: string }> {
    const response = await apiService.get<AIHealthResponse>('/utils/ai-health');

    if (response.success && response.data) {
      return { data: response.data };
    }

    return {
      data: null,
      error: getErrorMessage(response, 'Verifica OpenAI non riuscita'),
    };
  }
}

export const aiService = new AIService();
