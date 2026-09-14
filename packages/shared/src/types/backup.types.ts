/**
 * Snapshot di database + cartella uploads, creabili/ripristinabili solo da
 * un amministratore (sezione "Backup" nel menu utente del Marketplace).
 */

export type BackupStatus = 'creating' | 'ready' | 'failed' | 'restoring';

export interface BackupProgress {
  phase: 'db' | 'uploads' | 'done';
  collectionsDone: number;
  collectionsTotal: number;
}

export interface Backup {
  id: string;
  label: string;
  status: BackupStatus;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  finishedAt?: string;
  restoredAt?: string;
  error?: string;
  sizeBytes?: number;
  collectionsCount?: number;
  documentsCount?: number;
  progress?: BackupProgress;
}
