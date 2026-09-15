/*
 * File: /src/services/notifications.service.ts                                          *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 08/09/2026                                                             *
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
 * Notifiche in-app (oggi solo richieste di ruolo museo).
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
