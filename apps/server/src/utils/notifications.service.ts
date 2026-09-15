/*
 * File: /src/utils/notifications.service.ts                                             *
 * Project: @artaround/server                                                            *
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

/**
 * Crea, elenca e segna come lette le notifiche utente.
 */
import {
  NotificationModel,
  type INotification,
  type NotificationKind,
} from '../models/Notification.js';
import type { MuseumRole } from '@artaround/shared';

// Notifiche in-app (oggi solo richieste di ruolo museo — vedi
// NotificationKind in models/Notification.ts). Stesso principio dei Job:
// niente invio reale (email/push), il client le legge a polling finché la
// sessione resta aperta.

type NotifyPayload = {
  kind: NotificationKind;
  title: string;
  message: string;
  roleRequest?: { museumId: string; requestId: string; role: MuseumRole };
};

export const notify = async (userId: string, payload: NotifyPayload): Promise<void> => {
  await NotificationModel.create({ userId, ...payload, read: false, createdAt: new Date() });
};

export const notifyMany = async (userIds: string[], payload: NotifyPayload): Promise<void> => {
  if (userIds.length === 0) return;
  // De-duplica: un admin che è anche curatore del museo non deve ricevere la
  // stessa notifica due volte.
  const uniqueUserIds = Array.from(new Set(userIds));
  await NotificationModel.insertMany(
    uniqueUserIds.map((userId) => ({ userId, ...payload, read: false, createdAt: new Date() })),
  );
};

export const listForUser = async (userId: string, limit = 30): Promise<INotification[]> => {
  return NotificationModel.find({ userId }).sort({ createdAt: -1 }).limit(limit);
};

export const markRead = async (id: string, userId: string): Promise<void> => {
  await NotificationModel.updateOne({ _id: id, userId }, { $set: { read: true } });
};

export const markAllRead = async (userId: string): Promise<void> => {
  await NotificationModel.updateMany({ userId, read: false }, { $set: { read: true } });
};

// Chiamata quando una richiesta di ruolo viene approvata/rifiutata: toglie la
// notifica "pending" a TUTTI gli altri admin/curatori che la vedevano —
// altrimenti chi non l'ha gestita si ritroverebbe bottoni Approva/Rifiuta
// ormai inutilizzabili su una richiesta già decisa da qualcun altro.
export const resolveRoleRequestNotifications = async (requestId: string): Promise<void> => {
  await NotificationModel.deleteMany({
    kind: 'role-request-pending',
    'roleRequest.requestId': requestId,
  });
};
