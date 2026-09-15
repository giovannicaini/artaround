/*
 * File: /src/config/config.ts                                                           *
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
 * Configurazione centrale dell'app: carica le variabili d'ambiente dal file
 * giusto (.env.development/.env.production) ed espone `config` con i default.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env.production';

const moduleFilePath = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(moduleFilePath);
const serverAppDir = path.resolve(moduleDir, '../..');
const workspaceRootDir = path.resolve(moduleDir, '../../../..');

const resolveEnvPath = (): { envPath?: string; attemptedPaths: string[] } => {
  const attemptedPaths: string[] = [];
  const seenPaths = new Set<string>();
  const envCandidates = [envFile, '.env'];

  const addCandidatePath = (candidatePath: string): string | undefined => {
    const normalized = path.resolve(candidatePath);
    if (seenPaths.has(normalized)) return undefined;
    seenPaths.add(normalized);
    attemptedPaths.push(normalized);
    return fs.existsSync(normalized) ? normalized : undefined;
  };

  const explicitEnvPath = process.env.ENV_FILE_PATH || process.env.DOTENV_CONFIG_PATH;
  if (explicitEnvPath) {
    const found = addCandidatePath(explicitEnvPath);
    if (found) return { envPath: found, attemptedPaths };
  }

  const searchFrom = (startDir: string) => {
    let currentDir = path.resolve(startDir);

    for (let depth = 0; depth < 10; depth += 1) {
      for (const candidate of envCandidates) {
        const found = addCandidatePath(path.join(currentDir, candidate));
        if (found) return found;
      }

      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break;
      currentDir = parentDir;
    }

    return undefined;
  };

  const starts = [process.cwd(), moduleDir, serverAppDir, workspaceRootDir, '/app', '/usr/src/app'];

  for (const start of starts) {
    const found = searchFrom(start);
    if (found) return { envPath: found, attemptedPaths };
  }

  return { envPath: undefined, attemptedPaths };
};

const { envPath, attemptedPaths } = resolveEnvPath();
const dotenvResult = envPath ? dotenv.config({ path: envPath }) : dotenv.config();

const attemptedPreview = attemptedPaths.slice(0, 8).join(' | ');
const attemptedSuffix = attemptedPaths.length > 8 ? ` | ... (+${attemptedPaths.length - 8})` : '';
console.log(
  `[config] dotenv: NODE_ENV=${process.env.NODE_ENV || 'undefined'} cwd=${process.cwd()} moduleDir=${moduleDir} envFile=${envPath || '(default)'} envDir=${envPath ? path.dirname(envPath) : process.cwd()} attempts=${attemptedPreview}${attemptedSuffix}`,
);

if (dotenvResult.error) {
  console.warn(`[config] dotenv load error: ${dotenvResult.error.message}`);
}

const toBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/artaround_dev',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as const,

  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8000',
    ],
  },

  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
  },

  wikidata: {
    apiUrl: process.env.WIKIDATA_API_URL || 'https://www.wikidata.org/w/api.php',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB di default
  },

  seed: {
    onStart: toBoolean(process.env.SEED_ON_START, true),
    onlyIfEmpty: toBoolean(process.env.SEED_ONLY_IF_EMPTY, true),
  },

  // Ripristino di un dump (vedi scripts/db-dump.mjs) fatto dall'app stessa
  // all'avvio — per ambienti dove il database è raggiungibile solo dall'app
  // in esecuzione, non da uno script esterno lanciato a mano. Disattivato di
  // default: va acceso solo quando serve davvero un ripristino, mai lasciato
  // attivo in modo permanente (altrimenti ogni riavvio azzera il database).
  restoreDump: {
    onStart: toBoolean(process.env.RESTORE_DUMP_ON_START, false),
    dir: process.env.RESTORE_DUMP_DIR || path.join(workspaceRootDir, 'dump'),
  },
};
