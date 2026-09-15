/*
 * File: /src/utils/jobs.service.ts                                                      *
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
 * Gestione dei job in background (oggi generazione audio e sincronizzazione traduzioni): avvio con esclusione reciproca per tipo, avanzamento, cancellazione, riconciliazione all'avvio.
 */
import {
  JobModel,
  type IJob,
  type JobType,
  type JobStatus,
  type JobProgress,
} from '../models/Job.js';
import { AppError } from '../middleware/index.js';
import { getCuratedMuseumIds } from './policy.util.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

type AuthUser = NonNullable<AuthRequest['user']>;

// Processi lunghi (oggi solo la generazione audio OpenAI) eseguiti in
// background: partono da una richiesta HTTP che risponde subito, avanzano
// per conto proprio aggiornando un documento Job, e possono essere fermati
// a metà. Un solo Job per `type` alla volta, ovunque (vedi startJob) — la
// generazione audio condivide lo stesso account/quota OpenAI qualunque sia
// il museo o la visita, quindi l'esclusione reciproca è globale per tipo,
// non per museo.
//
// Il flag di cancellazione va controllato molto spesso (dentro un loop su
// centinaia di item) — un Set in memoria evita una query Mongo ad ogni
// iterazione; è specchiato su `cancelRequested` nel documento solo perché la
// richiesta di stop e l'esecuzione del job possono vivere in due request
// diverse (mai in due processi diversi: vedi reconcileOnStartup).
const cancelledJobIds = new Set<string>();

const emptyProgress = (): JobProgress => ({
  scanned: 0,
  updated: 0,
  generated: 0,
  removed: 0,
  failed: 0,
});

export const startJob = async (params: {
  type: JobType;
  museumId: string;
  visitId?: string;
  startedBy: string;
}): Promise<IJob> => {
  const active = await JobModel.findOne({ type: params.type, status: 'running' });
  if (active) {
    throw new AppError(
      409,
      'JOB_ALREADY_RUNNING',
      "C'è già una generazione audio in corso: attendi che finisca (o fermala) prima di avviarne un'altra",
    );
  }

  return JobModel.create({
    type: params.type,
    museumId: params.museumId,
    visitId: params.visitId,
    status: 'running',
    progress: { items: emptyProgress(), visitSteps: emptyProgress() },
    startedBy: params.startedBy,
    startedAt: new Date(),
    cancelRequested: false,
  });
};

export const updateProgress = async (
  jobId: string,
  progress: { items?: JobProgress; visitSteps?: JobProgress },
): Promise<void> => {
  const update: Record<string, JobProgress> = {};
  if (progress.items) update['progress.items'] = progress.items;
  if (progress.visitSteps) update['progress.visitSteps'] = progress.visitSteps;
  if (Object.keys(update).length === 0) return;
  await JobModel.updateOne({ _id: jobId }, { $set: update });
};

export const finishJob = async (
  jobId: string,
  status: Exclude<JobStatus, 'running'>,
  extra?: { progress?: { items?: JobProgress; visitSteps?: JobProgress }; error?: string },
): Promise<void> => {
  cancelledJobIds.delete(jobId);
  const update: Record<string, unknown> = { status, finishedAt: new Date() };
  if (extra?.progress?.items) update['progress.items'] = extra.progress.items;
  if (extra?.progress?.visitSteps) update['progress.visitSteps'] = extra.progress.visitSteps;
  if (extra?.error) update.error = extra.error;
  await JobModel.updateOne({ _id: jobId }, { $set: update });
};

export const requestCancel = async (jobId: string): Promise<void> => {
  cancelledJobIds.add(jobId);
  await JobModel.updateOne({ _id: jobId }, { $set: { cancelRequested: true } });
};

// Controllo sincrono, pensato per essere chiamato dentro un loop stretto
// (una volta per item/tappa) senza pesare con una query Mongo ad ogni giro.
export const isCancelled = (jobId: string): boolean => cancelledJobIds.has(jobId);

// Chiamata una volta all'avvio del server (vedi index.ts, dopo connectDB):
// un Job rimasto `running` da prima del boot non ha più nessun loop che lo
// porti avanti (il processo che lo eseguiva non esiste più, es. dopo un
// deploy) — va chiuso come fallito, altrimenti bloccherebbe per sempre
// l'esclusione reciproca su quel tipo.
export const reconcileOnStartup = async (): Promise<void> => {
  const result = await JobModel.updateMany(
    { status: 'running' },
    {
      $set: {
        status: 'failed',
        error: 'Interrotto da un riavvio del server',
        finishedAt: new Date(),
      },
    },
  );
  if (result.modifiedCount > 0) {
    console.log(
      `⚠️  ${result.modifiedCount} job interrotti da un riavvio del server, chiusi come falliti`,
    );
  }
};

// Job attivi (sempre inclusi) più gli ultimi conclusi, filtrati a quelli che
// `user` può vedere: admin tutti, altrimenti solo i musei di cui è curatore
// (stesso criterio con cui può avviarli — vedi authorizeResource('museum',
// 'manage') sulle route di generazione).
export const listJobs = async (user: AuthUser, recentLimit = 20): Promise<IJob[]> => {
  const museumFilter = user.isAdmin
    ? {}
    : { museumId: { $in: await getCuratedMuseumIds(user.id) } };

  const [active, recent] = await Promise.all([
    JobModel.find({ ...museumFilter, status: 'running' }).sort({ startedAt: -1 }),
    JobModel.find({ ...museumFilter, status: { $ne: 'running' } })
      .sort({ startedAt: -1 })
      .limit(recentLimit),
  ]);

  return [...active, ...recent];
};

export const getJobForCancel = async (jobId: string): Promise<IJob> => {
  const job = await JobModel.findById(jobId);
  if (!job) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job non trovato');
  }
  return job;
};
