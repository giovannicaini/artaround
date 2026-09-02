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
  /**
   * POST /api/uploads
   * Upload and process an image from a file
   * Accepts multipart/form-data with:
   * - file: image file
   * - category: one of museums, items, artworks, visits, users, misc
   * - width, height, fit, quality, format: optional processing params
   * - cropX, cropY, cropWidth, cropHeight: optional crop region
   * - oldPath: optional path of old image to delete (replacement)
   */
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

      // Delete old image if replacement
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

  /**
   * POST /api/uploads/from-url
   * Download, process and save an image from a URL
   * Body: { url, category, width, height, fit, quality, format, cropX, cropY, cropWidth, cropHeight, oldPath }
   */
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

      // Delete old image if replacement
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

  /**
   * DELETE /api/uploads
   * Delete an uploaded image
   * Body: { path: "/uploads/museums/abc123.webp" }
   */
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

  /**
   * POST /api/uploads/metadata
   * Get image metadata from an uploaded file (without saving)
   */
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

  /**
   * Parse image processing options from request body
   */
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
