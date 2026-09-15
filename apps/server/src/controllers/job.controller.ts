/*
 * File: /src/controllers/job.controller.ts                                              *
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
 * Consultazione e cancellazione dei job in background (generazione audio, sincronizzazione traduzioni).
 */
import { Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { assertCan } from '../utils/policy.util.js';
import * as jobsService from '../utils/jobs.service.js';

// Job in background (oggi solo generazione audio, vedi jobs.service.ts) —
// elenco per il pannello notifiche del marketplace e cancellazione.
export class JobController {
  // GET /api/jobs — job attivi + ultimi conclusi, filtrati ai musei che
  // l'utente può gestire (admin: tutti).
  static list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const jobs = await jobsService.listJobs(req.user);

    res.json({ success: true, data: jobs });
  });

  // POST /api/jobs/:id/cancel — richiede l'interruzione di un job in corso;
  // il job stesso la applica al prossimo item/tappa (vedi jobsService.isCancelled).
  static cancel = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id del job è obbligatorio");
    }

    const job = await jobsService.getJobForCancel(id);

    await assertCan(
      req.user,
      'manage',
      'museum',
      { museumId: job.museumId },
      'Solo il curatore del museo può fermare questa generazione',
    );

    if (job.status !== 'running') {
      res.json({ success: true, data: job, message: 'Il job non è più in corso' });
      return;
    }

    await jobsService.requestCancel(String(job._id));

    res.json({ success: true, message: 'Interruzione richiesta' });
  });
}
