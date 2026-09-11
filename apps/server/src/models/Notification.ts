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
