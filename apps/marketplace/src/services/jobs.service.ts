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
