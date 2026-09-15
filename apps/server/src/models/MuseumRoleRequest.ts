/*
 * File: /src/models/MuseumRoleRequest.ts                                                *
 * Project: @artaround/server                                                            *
 * Last Modified: 05/09/2026                                                             *
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
 * Schema Mongoose delle richieste di ruolo su un museo (es. diventare curatore), in attesa di approvazione.
 */
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
