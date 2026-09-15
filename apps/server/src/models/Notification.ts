/*
 * File: /src/models/Notification.ts                                                     *
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
 * Schema Mongoose delle notifiche utente (richieste di ruolo, altri eventi da segnalare in app).
 */
import mongoose, { Schema, Document } from 'mongoose';
import { MuseumRole } from '@artaround/shared';

// Oggi solo le richieste di ruolo museo — la forma (kind + testo già pronto +
// dati opzionali per azioni inline) resta comunque pronta per altri tipi di
// notifica futuri, stesso principio di JobType in Job.ts.
export type NotificationKind = 'role-request-pending' | 'role-request-resolved';

export interface INotification extends Document {
  // Destinatario.
  userId: string;
  kind: NotificationKind;
  // Testo già pronto (italiano), costruito nel controller che genera la
  // notifica — stesso stile dei messaggi già costruiti altrove (es.
  // syncLanguages), niente sistema di chiavi i18n lato notifica.
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  // Solo per role-request-pending: dati per i bottoni Approva/Rifiuta inline
  // nel pannello (vedi notifications.service.ts resolveRoleRequestNotifications).
  roleRequest?: {
    museumId: string;
    requestId: string;
    role: MuseumRole;
  };
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },
    kind: {
      type: String,
      enum: ['role-request-pending', 'role-request-resolved'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, required: true, default: Date.now },
    roleRequest: {
      museumId: String,
      requestId: String,
      role: { type: String, enum: Object.values(MuseumRole) },
    },
  },
  { timestamps: false },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ 'roleRequest.requestId': 1 });

export const NotificationModel = mongoose.model<INotification>('Notification', notificationSchema);
