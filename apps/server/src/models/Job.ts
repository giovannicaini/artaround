/*
 * File: /src/models/Job.ts                                                              *
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
 * Schema Mongoose dei job in background (generazione audio, sincronizzazione traduzioni) con relativo stato e progresso.
 */
import mongoose, { Schema, Document } from 'mongoose';

export type JobType = 'generate-audio' | 'sync-languages';
export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  scanned: number;
  updated: number;
  generated: number;
  removed: number;
  failed: number;
}

export interface IJob extends Document {
  type: JobType;
  // Sempre presente, anche per un job limitato a una singola visita: il museo
  // a cui appartiene, usato per i controlli di permesso e per il filtro della
  // lista job per curatore (vedi jobs.service.ts).
  museumId: string;
  // Presente solo se il job è limitato a una visita — assente per un job
  // sull'intero catalogo del museo.
  visitId?: string;
  status: JobStatus;
  progress: {
    items: JobProgress;
    visitSteps: JobProgress;
  };
  error?: string;
  startedBy: string;
  startedAt: Date;
  finishedAt?: Date;
  cancelRequested: boolean;
}

const jobProgressSchema = new Schema<JobProgress>(
  {
    scanned: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    generated: { type: Number, default: 0 },
    removed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false },
);

const jobSchema = new Schema<IJob>(
  {
    type: { type: String, enum: ['generate-audio', 'sync-languages'], required: true, index: true },
    museumId: { type: String, required: true, index: true },
    visitId: { type: String },
    status: {
      type: String,
      enum: ['running', 'completed', 'failed', 'cancelled'],
      required: true,
      default: 'running',
      index: true,
    },
    progress: {
      items: { type: jobProgressSchema, default: () => ({}) },
      visitSteps: { type: jobProgressSchema, default: () => ({}) },
    },
    error: String,
    startedBy: { type: String, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    finishedAt: Date,
    cancelRequested: { type: Boolean, default: false },
  },
  { timestamps: false },
);

export const JobModel = mongoose.model<IJob>('Job', jobSchema);
