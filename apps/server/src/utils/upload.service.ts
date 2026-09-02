import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { config } from '../config/config.js';
import type { ImageProcessOptions, UploadResult, UploadCategory } from '@artaround/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// cartella condivisa alla radice del monorepo, così tutte le app la vedono
const UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const RESPONSIVE_WIDTHS = [480, 768, 1200];

async function ensureUploadDirs(): Promise<void> {
  const categories: UploadCategory[] = ['museums', 'items', 'artworks', 'visits', 'users', 'misc'];
  for (const cat of categories) {
    await fs.mkdir(path.join(UPLOADS_DIR, cat), { recursive: true });
  }
}

ensureUploadDirs();

// file in memoria finché sharp non li ha processati, poi si scrivono su disco
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

export class UploadService {
  static async processAndSave(
    buffer: Buffer,
    originalName: string,
    category: UploadCategory,
    options: ImageProcessOptions = {},
  ): Promise<UploadResult> {
    await ensureUploadDirs();

    const { width, height, fit = 'cover', quality = 85, format = 'webp' } = options;

    const hash = crypto.randomBytes(12).toString('hex');
    const ext = format === 'jpeg' ? 'jpg' : format;
    const filename = `${hash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, category, filename);

    let pipeline = sharp(buffer);

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

    if (width || height) {
      pipeline = pipeline.resize(width || undefined, height || undefined, {
        fit,
        withoutEnlargement: true,
      });
    }

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

    // un solo render, poi ne derivo le varianti responsive sotto
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

    const urlPath = new URL(imageUrl).pathname;
    const originalName = path.basename(urlPath) || 'image';

    return this.processAndSave(buffer, originalName, category, options);
  }

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

      // cancella anche le varianti responsive, hanno il suffisso __w{width}
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

  static async getMetadata(
    buffer: Buffer,
  ): Promise<{ width: number; height: number; format: string }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  }

  static getUploadsDir(): string {
    return UPLOADS_DIR;
  }
}
