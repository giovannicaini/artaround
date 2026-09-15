/*
 * File: /src/utils/upload.service.ts                                                    *
 * Project: @artaround/server                                                            *
 * Last Modified: 13/09/2026                                                             *
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
 * Configurazione Multer per i caricamenti e utilità per salvare/eliminare i file caricati (immagini con varianti, audio).
 */
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config } from '../config/config.js';
import type { ImageProcessOptions, UploadResult, UploadCategory } from '@artaround/shared';

// Equivalente ESM di __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cartella upload - condivisa alla radice del monorepo così tutte le app la vedono
const UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads');

// Tipi MIME immagine consentiti
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const RESPONSIVE_WIDTHS = [480, 768, 1200];

// Sottocartelle per i diversi tipi di entità

// Assicura che la cartella upload e le sottocartelle esistano
async function ensureUploadDirs(): Promise<void> {
  const categories: UploadCategory[] = ['museums', 'items', 'artworks', 'visits', 'users', 'misc'];
  for (const cat of categories) {
    await fs.mkdir(path.join(UPLOADS_DIR, cat), { recursive: true });
  }
}

// Assicura che le cartelle esistano all'import
ensureUploadDirs();

// Configurazione Multer per l'upload temporaneo dei file
// I file sono tenuti in memoria per l'elaborazione con sharp prima del salvataggio
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo file non supportato: ${file.mimetype}. Usa: JPG, PNG, WebP o GIF.`));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});

// Multer separato per l'audio caricato a mano (item.controller.ts,
// uploadAudio): niente elaborazione con sharp, solo tipi audio, limite più
// alto di un'immagine tipica (un audio di qualche minuto pesa di più).
const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/webm',
  'audio/aac',
];

const audioFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (ALLOWED_AUDIO_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo file non supportato: ${file.mimetype}. Usa MP3, WAV, OGG, M4A o AAC.`));
  }
};

export const audioUpload = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024,
  },
});

export class UploadService {
  // /**
  // Elabora e salva un file immagine caricato
  static async processAndSave(
    buffer: Buffer,
    originalName: string,
    category: UploadCategory,
    options: ImageProcessOptions = {},
  ): Promise<UploadResult> {
    await ensureUploadDirs();

    const { width, height, fit = 'cover', quality = 85, format = 'webp' } = options;

    // Genera un nome file univoco
    const hash = crypto.randomBytes(12).toString('hex');
    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `${hash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, category, filename);

    // Costruisce la pipeline sharp
    let pipeline = sharp(buffer);

    // Applica prima il ritaglio se specificato
    if (
      options.cropX !== undefined &&
      options.cropY !== undefined &&
      options.cropWidth !== undefined &&
      options.cropHeight !== undefined
    ) {
      pipeline = pipeline.extract({
        left: Math.round(options.cropX),
        top: Math.round(options.cropY),
        width: Math.round(options.cropWidth),
        height: Math.round(options.cropHeight),
      });
    }

    // Applica il resize se specificato
    if (width || height) {
      pipeline = pipeline.resize(width || undefined, height || undefined, {
        fit,
        withoutEnlargement: true,
      });
    }

    // Converte nel formato di destinazione con la qualità richiesta
    switch (format) {
      case 'jpeg':
        pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        break;
      case 'png':
        pipeline = pipeline.png({ quality });
        break;
      case 'webp':
        pipeline = pipeline.webp({ quality });
        break;
    }

    // Renderizza l'immagine elaborata una volta, poi scrive originale + varianti responsive
    const outputBuffer = await pipeline.toBuffer();
    const outputMetadata = await sharp(outputBuffer).metadata();

    await fs.writeFile(filePath, outputBuffer);

    const baseName = path.parse(filename).name;

    await Promise.all(
      RESPONSIVE_WIDTHS.map(async (variantWidth) => {
        const variantFilename = `${baseName}__w${variantWidth}.${ext}`;
        const variantPath = path.join(UPLOADS_DIR, category, variantFilename);

        await sharp(outputBuffer)
          .resize({
            width: variantWidth,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toFile(variantPath);
      }),
    );

    const mimeType = `image/${format === 'jpeg' ? 'jpeg' : format}`;

    return {
      path: `/uploads/${category}/${filename}`,
      originalName,
      width: outputMetadata.width || 0,
      height: outputMetadata.height || 0,
      size: outputBuffer.length,
      mimeType,
    };
  }

  // /**
  // Elabora e salva un'immagine scaricata da un URL
  static async processFromUrl(
    imageUrl: string,
    category: UploadCategory,
    options: ImageProcessOptions = {},
  ): Promise<UploadResult> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Impossibile scaricare l'immagine: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      throw new Error(`Il contenuto non è un'immagine: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Estrae il nome file originale dall'URL
    const urlPath = new URL(imageUrl).pathname;
    const originalName = path.basename(urlPath) || 'image';

    return this.processAndSave(buffer, originalName, category, options);
  }

  // /**
  // Elimina un file caricato dal suo percorso
  // @param filePath - Percorso relativo tipo /uploads/museums/abc123.webp
  static async deleteFile(filePath: string): Promise<boolean> {
    if (!filePath || !filePath.startsWith('/uploads/')) {
      return false;
    }

    const relativePath = filePath.replace('/uploads/', '');
    const absolutePath = path.join(UPLOADS_DIR, relativePath);
    const absoluteDir = path.dirname(absolutePath);
    const parsed = path.parse(absolutePath);

    try {
      await fs.access(absolutePath);
      await fs.unlink(absolutePath);

      // Elimina le varianti responsive generate col suffisso __w{width}
      const filesInDir = await fs.readdir(absoluteDir);
      const variantPrefix = `${parsed.name}__w`;

      await Promise.all(
        filesInDir
          .filter(
            (entry) =>
              entry.startsWith(variantPrefix) && path.extname(entry).toLowerCase() === parsed.ext,
          )
          .map(async (entry) => {
            const variantAbsolutePath = path.join(absoluteDir, entry);
            await fs.unlink(variantAbsolutePath).catch(() => undefined);
          }),
      );

      console.log(`[Upload] Deleted: ${filePath}`);
      return true;
    } catch {
      console.warn(`[Upload] File not found for deletion: ${filePath}`);
      return false;
    }
  }

  // /**
  // Ottieni il percorso assoluto del filesystem alla cartella upload
  static getUploadsDir(): string {
    return UPLOADS_DIR;
  }
}
