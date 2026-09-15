/*
 * File: /src/types/backup.types.ts                                                      *
 * Project: @artaround/shared                                                            *
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
