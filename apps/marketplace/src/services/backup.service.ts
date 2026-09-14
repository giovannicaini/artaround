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
