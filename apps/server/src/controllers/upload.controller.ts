import { Request, Response, NextFunction } from 'express';
import { UploadService } from '../utils/upload.service.js';
import { AppError } from '../middleware/index.js';
import type { ImageProcessOptions, UploadCategory } from '@artaround/shared';

const VALID_CATEGORIES: UploadCategory[] = [
  'museums',
  'items',
  'artworks',
  'visits',
  'users',
  'misc',
];

export class UploadController {
  static async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'Nessun file caricato');
      }

      const category = (req.body.category || 'misc') as UploadCategory;
      if (!VALID_CATEGORIES.includes(category)) {
        throw new AppError(400, 'INVALID_CATEGORY', `Categoria non valida: ${category}`);
      }

      const options = UploadController.parseProcessOptions(req.body);
      const result = await UploadService.processAndSave(
        req.file.buffer,
        req.file.originalname,
        category,
        options,
      );

      // sostituzione: cancella la vecchia immagine
      if (req.body.oldPath) {
        await UploadService.deleteFile(req.body.oldPath);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadFromUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { url, category = 'misc', oldPath } = req.body;

      if (!url) {
        throw new AppError(400, 'NO_URL', 'URL immagine mancante');
      }

      if (!VALID_CATEGORIES.includes(category as UploadCategory)) {
        throw new AppError(400, 'INVALID_CATEGORY', `Categoria non valida: ${category}`);
      }

      const options = UploadController.parseProcessOptions(req.body);
      const result = await UploadService.processFromUrl(url, category as UploadCategory, options);

      // sostituzione: cancella la vecchia immagine
      if (oldPath) {
        await UploadService.deleteFile(oldPath);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { path } = req.body;

      if (!path) {
        throw new AppError(400, 'NO_PATH', 'Percorso file mancante');
      }

      const deleted = await UploadService.deleteFile(path);

      res.json({
        success: true,
        data: { deleted },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMetadata(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'Nessun file caricato');
      }

      const metadata = await UploadService.getMetadata(req.file.buffer);

      res.json({
        success: true,
        data: metadata,
      });
    } catch (error) {
      next(error);
    }
  }

  private static parseProcessOptions(body: Record<string, string>): ImageProcessOptions {
    const options: ImageProcessOptions = {};

    if (body.width) options.width = parseInt(body.width, 10);
    if (body.height) options.height = parseInt(body.height, 10);
    if (body.fit) options.fit = body.fit as ImageProcessOptions['fit'];
    if (body.quality) options.quality = parseInt(body.quality, 10);
    if (body.format) options.format = body.format as ImageProcessOptions['format'];
    if (body.cropX !== undefined) options.cropX = parseFloat(body.cropX);
    if (body.cropY !== undefined) options.cropY = parseFloat(body.cropY);
    if (body.cropWidth !== undefined) options.cropWidth = parseFloat(body.cropWidth);
    if (body.cropHeight !== undefined) options.cropHeight = parseFloat(body.cropHeight);

    return options;
  }
}
