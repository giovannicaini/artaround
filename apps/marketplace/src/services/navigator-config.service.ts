import type {
  CreateNavigatorConfigData,
  NavigatorConfig,
  UpdateNavigatorConfigData,
} from '@artaround/shared';
import { apiService, getErrorMessage } from './api.service';

/**
 * CRUD delle configurazioni Navigator (globale e per museo).
 */
export class NavigatorConfigService {
  // Admin: tutte le config. Curatore: solo quelle dei musei di cui è curatore.
  async list(): Promise<NavigatorConfig[]> {
    const response = await apiService.get<NavigatorConfig[]>('/navigator-configs');
    return response.success && response.data ? response.data : [];
  }

  async create(
    data: CreateNavigatorConfigData,
  ): Promise<{ data: NavigatorConfig | null; error?: string }> {
    const response = await apiService.post<NavigatorConfig>('/navigator-configs', data);
    if (response.success && response.data) {
      return { data: response.data };
    }
    return {
      data: null,
      error: getErrorMessage(response, 'Errore durante la creazione della configurazione'),
    };
  }

  async update(
    id: string,
    data: UpdateNavigatorConfigData,
  ): Promise<{ data: NavigatorConfig | null; error?: string }> {
    const response = await apiService.put<NavigatorConfig>(`/navigator-configs/${id}`, data);
    if (response.success && response.data) {
      return { data: response.data };
    }
    return {
      data: null,
      error: getErrorMessage(response, "Errore durante l'aggiornamento della configurazione"),
    };
  }

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(`/navigator-configs/${id}`);
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, "Errore durante l'eliminazione della configurazione"),
    };
  }
}

export const navigatorConfigService = new NavigatorConfigService();
