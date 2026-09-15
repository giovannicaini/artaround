/*
 * File: /src/services/navigator-config.service.ts                                       *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 07/09/2026                                                             *
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
