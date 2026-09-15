/*
 * File: /src/services/jobs.service.ts                                                   *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

import { apiService, getErrorMessage } from './api.service';

export type JobType = 'generate-audio' | 'sync-languages';
export type JobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  scanned: number;
  updated: number;
  generated: number;
  removed: number;
  failed: number;
}

export interface Job {
  _id: string;
  type: JobType;
  museumId: string;
  visitId?: string;
  status: JobStatus;
  progress: { items: JobProgress; visitSteps: JobProgress };
  error?: string;
  startedBy: string;
  startedAt: string;
  finishedAt?: string;
  cancelRequested: boolean;
}

const POLL_INTERVAL_MS = 5000;

/**
 * Job in background (oggi solo generazione audio e sincronizzazione traduzioni).
 */
class JobsService {
  private jobs: Job[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  getJobs(): Job[] {
    return this.jobs;
  }

  // Senza `type`: job attivo di qualunque tipo. Con `type`: solo quel tipo (audio/traduzioni girano insieme).
  hasActiveJob(type?: JobType): boolean {
    return this.jobs.some(
      (job) => job.status === 'running' && (type === undefined || job.type === type),
    );
  }

  activeJobFor(params: { type?: JobType; museumId?: string; visitId?: string }): Job | null {
    return (
      this.jobs.find(
        (job) =>
          job.status === 'running' &&
          (params.type === undefined || job.type === params.type) &&
          (params.museumId === undefined || job.museumId === params.museumId) &&
          (params.visitId === undefined || job.visitId === params.visitId),
      ) ?? null
    );
  }

  async refresh(): Promise<Job[]> {
    const response = await apiService.get<Job[]>('/jobs');
    if (response.success && response.data) {
      this.jobs = response.data;
    }
    window.dispatchEvent(new CustomEvent<Job[]>('jobs-changed', { detail: this.jobs }));
    this.reschedulePolling();
    return this.jobs;
  }

  private reschedulePolling(): void {
    const hasActive = this.hasActiveJob();
    if (hasActive && !this.pollTimer) {
      this.pollTimer = setInterval(() => void this.refresh(), POLL_INTERVAL_MS);
    } else if (!hasActive && this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async cancelJob(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post(`/jobs/${id}/cancel`, {});
    if (response.success) {
      await this.refresh();
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, "Errore durante l'interruzione del job"),
    };
  }
}

export const jobsService = new JobsService();
