import type { NavigatorAppConfig } from '@artaround/shared';
import { apiService } from './api.service';

export class NavigatorDefaultConfigService {
  async getConfigs(): Promise<{ data: NavigatorAppConfig[]; error?: string }> {
    const response = await apiService.get<NavigatorAppConfig[]>('/utils/navigator-default-configs');

    if (response.success && response.data) {
      return { data: response.data };
    }

    const errorMessage =
      typeof response.error === 'string'
        ? response.error
        : response.error?.message || 'Errore durante il caricamento delle configurazioni default';

    return { data: [], error: errorMessage };
  }

  async saveConfigs(
    configs: NavigatorAppConfig[],
  ): Promise<{ data: NavigatorAppConfig[]; error?: string }> {
    const response = await apiService.put<NavigatorAppConfig[]>(
      '/utils/navigator-default-configs',
      {
        navigatorConfigs: configs,
      },
    );

    if (response.success && response.data) {
      return { data: response.data };
    }

    const errorMessage =
      typeof response.error === 'string'
        ? response.error
        : response.error?.message || 'Errore durante il salvataggio delle configurazioni default';

    return { data: [], error: errorMessage };
  }
}

export const navigatorDefaultConfigService = new NavigatorDefaultConfigService();
