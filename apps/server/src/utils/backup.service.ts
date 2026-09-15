/*
 * File: /src/utils/backup.service.ts                                                    *
 * Project: @artaround/server                                                            *
 * Last Modified: 15/09/2026                                                             *
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
 * Snapshot di database + cartella uploads (sezione Backup, solo admin), per
 * poter "provare e poi rimettere tutto a posto".
 */
// Niente mongodump/mongorestore: non sono installabili su questa macchina
// (nessun accesso root), quindi il dump passa dal driver Mongo stesso (EJSON
// canonico, preserva ObjectId/Date/Map) e gli upload da tar/gzip, entrambi
// già presenti sul sistema.

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import mongoose from 'mongoose';
import { EJSON } from 'bson';
import type { Backup } from '@artaround/shared';
import { UploadService } from './upload.service.js';
import { restoreDump } from '../scripts/restore-dump.js';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Fuori da uploads/ (per non finire dentro le proprie stesse copie) e fuori
// da qualunque cartella servita staticamente (vedi index.ts: solo /uploads,
// /marketplace, /navigator).
const BACKUPS_DIR = path.resolve(__dirname, '../../../../backups');
const INDEX_FILE = path.join(BACKUPS_DIR, 'index.json');

// Un solo backup/ripristino alla volta, ovunque: entrambi leggono/scrivono
// l'intero DB e la cartella uploads, farli girare insieme corromperebbe i dati.
let operationInProgress = false;

async function ensureBackupsDir(): Promise<void> {
  await fsp.mkdir(BACKUPS_DIR, { recursive: true });
}

async function readIndex(): Promise<Backup[]> {
  await ensureBackupsDir();
  try {
    const raw = await fsp.readFile(INDEX_FILE, 'utf-8');
    return JSON.parse(raw) as Backup[];
  } catch {
    return [];
  }
}

async function writeIndex(entries: Backup[]): Promise<void> {
  await ensureBackupsDir();
  await fsp.writeFile(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

async function updateEntry(id: string, patch: Partial<Backup>): Promise<void> {
  const entries = await readIndex();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], ...patch };
  await writeIndex(entries);
}

async function dirSizeBytes(dir: string): Promise<number> {
  let total = 0;
  const items = await fsp.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      total += await dirSizeBytes(full);
    } else {
      total += (await fsp.stat(full)).size;
    }
  }
  return total;
}

async function clearDirContents(dir: string): Promise<void> {
  const items = await fsp.readdir(dir);
  await Promise.all(
    items.map((item) => fsp.rm(path.join(dir, item), { recursive: true, force: true })),
  );
}

export async function listBackups(): Promise<Backup[]> {
  const entries = await readIndex();
  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isOperationInProgress(): boolean {
  return operationInProgress;
}

// Avvia la creazione in background e ritorna subito la entry (status 'creating'):
// il chiamante risponde 202, il progresso si segue con GET /api/admin/backups.
export async function createBackup(
  label: string,
  createdBy: string,
  createdByName: string,
): Promise<Backup> {
  if (operationInProgress) {
    throw new Error('Un altro backup o ripristino è già in corso: attendi che finisca');
  }
  operationInProgress = true;

  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: Backup = {
    id,
    label: label.trim() || `Snapshot del ${new Date().toLocaleString('it-IT')}`,
    status: 'creating',
    createdAt: new Date().toISOString(),
    createdBy,
    createdByName,
    progress: { phase: 'db', collectionsDone: 0, collectionsTotal: 0 },
  };

  const entries = await readIndex();
  entries.push(entry);
  await writeIndex(entries);

  void runCreateBackup(id).finally(() => {
    operationInProgress = false;
  });

  return entry;
}

async function runCreateBackup(id: string): Promise<void> {
  const backupDir = path.join(BACKUPS_DIR, id);
  const dbDir = path.join(backupDir, 'db');

  try {
    await fsp.mkdir(dbDir, { recursive: true });

    const db = mongoose.connection.db;
    if (!db) throw new Error('Connessione al database non disponibile');

    // La entry "backups" stessa non esiste in Mongo (l'indice vive solo su
    // disco, vedi INDEX_FILE): niente da escludere qui.
    const collections = await db.listCollections().toArray();
    let documentsCount = 0;

    await updateEntry(id, {
      progress: { phase: 'db', collectionsDone: 0, collectionsTotal: collections.length },
    });

    for (let i = 0; i < collections.length; i++) {
      const name = collections[i].name;
      const docs = await db.collection(name).find({}).toArray();
      documentsCount += docs.length;
      await fsp.writeFile(
        path.join(dbDir, `${name}.json`),
        EJSON.stringify(docs, { relaxed: false }),
        'utf-8',
      );

      // Indici (unique, testo, composti...), come scripts/db-dump.mjs — esclude
      // "_id_", sempre creato in automatico e non ricreabile esplicitamente.
      const indexes = (await db.collection(name).indexes()).filter((idx) => idx.name !== '_id_');
      await fsp.writeFile(
        path.join(dbDir, `${name}.indexes.json`),
        EJSON.stringify(indexes, { relaxed: false }),
        'utf-8',
      );

      await updateEntry(id, {
        progress: { phase: 'db', collectionsDone: i + 1, collectionsTotal: collections.length },
      });
    }

    await updateEntry(id, {
      progress: {
        phase: 'uploads',
        collectionsDone: collections.length,
        collectionsTotal: collections.length,
      },
    });

    const uploadsDir = UploadService.getUploadsDir();
    await fsp.mkdir(uploadsDir, { recursive: true });
    const uploadsArchive = path.join(backupDir, 'uploads.tar.gz');
    await execFileAsync('tar', ['-czf', uploadsArchive, '-C', uploadsDir, '.']);

    const sizeBytes = await dirSizeBytes(backupDir);

    await updateEntry(id, {
      status: 'ready',
      finishedAt: new Date().toISOString(),
      sizeBytes,
      collectionsCount: collections.length,
      documentsCount,
      progress: {
        phase: 'done',
        collectionsDone: collections.length,
        collectionsTotal: collections.length,
      },
    });
  } catch (err) {
    console.error(`[backup.service] creazione backup ${id} fallita:`, err);
    await updateEntry(id, {
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Errore sconosciuto',
    });
  }
}

export async function restoreBackup(id: string): Promise<void> {
  if (operationInProgress) {
    throw new Error('Un altro backup o ripristino è già in corso: attendi che finisca');
  }
  const entries = await readIndex();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error('Backup non trovato');
  if (entry.status !== 'ready')
    throw new Error('Questo backup non è pronto per essere ripristinato');

  operationInProgress = true;
  await updateEntry(id, { status: 'restoring' });

  void runRestoreBackup(id).finally(() => {
    operationInProgress = false;
  });
}

async function runRestoreBackup(id: string): Promise<void> {
  const backupDir = path.join(BACKUPS_DIR, id);
  const dbDir = path.join(backupDir, 'db');

  try {
    // Stesso script già usato per i ripristini da deploy (vedi
    // config.restoreDump.onStart in index.ts): svuota e reinserisce ogni
    // collection trovata nella cartella, indici compresi.
    await restoreDump(dbDir);

    const uploadsDir = UploadService.getUploadsDir();
    await fsp.mkdir(uploadsDir, { recursive: true });
    await clearDirContents(uploadsDir);
    const uploadsArchive = path.join(backupDir, 'uploads.tar.gz');
    if (fs.existsSync(uploadsArchive)) {
      await execFileAsync('tar', ['-xzf', uploadsArchive, '-C', uploadsDir]);
    }

    await updateEntry(id, { status: 'ready', restoredAt: new Date().toISOString() });
  } catch (err) {
    console.error(`[backup.service] ripristino backup ${id} fallito:`, err);
    await updateEntry(id, {
      status: 'failed',
      error: `Ripristino fallito: ${err instanceof Error ? err.message : 'errore sconosciuto'}`,
    });
  }
}

export async function deleteBackup(id: string): Promise<void> {
  const entries = await readIndex();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error('Backup non trovato');
  if (entry.status === 'creating' || entry.status === 'restoring') {
    throw new Error('Non puoi eliminare un backup mentre è in lavorazione');
  }

  await fsp.rm(path.join(BACKUPS_DIR, id), { recursive: true, force: true });
  await writeIndex(entries.filter((e) => e.id !== id));
}

// Chiamata all'avvio del server (vedi index.ts, dopo connectDB): un backup
// rimasto 'creating'/'restoring' da prima del boot non ha più nessun
// processo che lo porti avanti — soprattutto per un ripristino a metà, i
// dati potrebbero essere in uno stato incoerente: va segnalato come fallito,
// mai lasciato "in corso" per sempre.
export async function reconcileOnStartup(): Promise<void> {
  const entries = await readIndex();
  let changed = false;
  for (const entry of entries) {
    if (entry.status === 'creating' || entry.status === 'restoring') {
      const wasRestoring = entry.status === 'restoring';
      entry.status = 'failed';
      entry.error = wasRestoring
        ? 'Ripristino interrotto da un riavvio del server: il database potrebbe essere in uno stato incoerente'
        : 'Interrotto da un riavvio del server';
      entry.finishedAt = new Date().toISOString();
      changed = true;
    }
  }
  if (changed) {
    await writeIndex(entries);
    console.log('⚠️  Backup interrotti da un riavvio del server, segnati come falliti');
  }
  operationInProgress = false;
}
