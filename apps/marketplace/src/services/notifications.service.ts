import { apiService } from './api.service';
import type { MuseumRole } from '@artaround/shared';

export type NotificationKind = 'role-request-pending' | 'role-request-resolved';

export interface Notification {
  _id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  roleRequest?: { museumId: string; requestId: string; role: MuseumRole };
}

const POLL_INTERVAL_MS = 20000;

/**
 * Notifiche in-app (oggi solo richieste di ruolo museo, vedi
 * notifications.service.ts lato server) — stesso schema di jobs.service.ts
 * (polling condiviso, evento 'notifications-changed'), ma il polling qui
 * gira sempre finché il componente che lo avvia resta montato: a differenza
 * di un job, una notifica non letta non ha uno stato "attivo" che ne
 * giustifichi lo stop — resta lì finché qualcuno la legge.
 */
class NotificationsService {
  private notifications: Notification[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  getNotifications(): Notification[] {
    return this.notifications;
  }

  unreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  async refresh(): Promise<Notification[]> {
    const response = await apiService.get<Notification[]>('/notifications');
    if (response.success && response.data) {
      this.notifications = response.data;
    }
    window.dispatchEvent(
      new CustomEvent<Notification[]>('notifications-changed', { detail: this.notifications }),
    );
    return this.notifications;
  }

  // Avviato una sola volta (da admin-header, sempre montato) — chi vuole solo
  // il refresh immediato dopo un'azione locale chiama refresh() direttamente.
  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
  }

  async markRead(id: string): Promise<void> {
    const response = await apiService.post(`/notifications/${id}/read`, {});
    if (response.success) {
      await this.refresh();
    }
  }

  async markAllRead(): Promise<void> {
    const response = await apiService.post('/notifications/read-all', {});
    if (response.success) {
      await this.refresh();
    }
  }
}

export const notificationsService = new NotificationsService();
