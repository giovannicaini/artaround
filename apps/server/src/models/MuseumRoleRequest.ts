import mongoose, { Schema, Document } from 'mongoose';
import { MuseumRoleRequest as IMuseumRoleRequest, MuseumRole } from '@artaround/shared';

export interface MuseumRoleRequestDocument extends Omit<IMuseumRoleRequest, '_id'>, Document {}

const museumRoleRequestSchema = new Schema<MuseumRoleRequestDocument>({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  museumId: {
    type: String,
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: Object.values(MuseumRole),
    required: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
});

// Impedisce di accumulare più richieste identiche (stesso utente, museo, ruolo)
museumRoleRequestSchema.index({ userId: 1, museumId: 1, role: 1 }, { unique: true });

export const MuseumRoleRequestModel = mongoose.model<MuseumRoleRequestDocument>(
  'MuseumRoleRequest',
  museumRoleRequestSchema,
);
