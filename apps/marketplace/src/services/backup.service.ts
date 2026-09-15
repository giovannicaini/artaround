/*
 * File: /src/services/backup.service.ts                                                 *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import { apiService, getErrorMessage } from './api.service';
import type { Backup } from '@artaround/shared';

export type { Backup };

/**
 * Snapshot di database + cartella uploads (solo admin): creazione/ripristino
 * girano in background lato server, qui solo lettura/avvio/eliminazione.
 */
class BackupService {
  async list(): Promise<Backup[]> {
    const response = await apiService.get<Backup[]>('/admin/backups');
    return response.success && response.data ? response.data : [];
  }

  async create(label: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post<Backup>('/admin/backups', { label });
    if (response.success) return { success: true };
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante la creazione del backup'),
    };
  }

  async restore(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post(`/admin/backups/${id}/restore`, {});
    if (response.success) return { success: true };
    return { success: false, error: getErrorMessage(response, 'Errore durante il ripristino') };
  }

  async remove(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(`/admin/backups/${id}`);
    if (response.success) return { success: true };
    return { success: false, error: getErrorMessage(response, "Errore durante l'eliminazione") };
  }
}

export const backupService = new BackupService();
