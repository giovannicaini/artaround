import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
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
   * Carica ed elabora un'immagine da un file
   * Accetta multipart/form-data con:
   * - file: file immagine
   * - category: una tra museums, items, artworks, visits, users, misc
   * - width, height, fit, quality, format: parametri di elaborazione opzionali
   * - cropX, cropY, cropWidth, cropHeight: regione di ritaglio opzionale
   * - oldPath: percorso opzionale della vecchia immagine da eliminare (sostituzione)
   */
  static uploadImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

    // Elimina la vecchia immagine se è una sostituzione
    if (req.body.oldPath) {
      await UploadService.deleteFile(req.body.oldPath);
    }

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * POST /api/uploads/from-url
   * Scarica, elabora e salva un'immagine da un URL
   * Body: { url, category, width, height, fit, quality, format, cropX, cropY, cropWidth, cropHeight, oldPath }
   */
  static uploadFromUrl = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { url, category = 'misc', oldPath } = req.body;

    if (!url) {
      throw new AppError(400, 'NO_URL', 'URL immagine mancante');
    }

    if (!VALID_CATEGORIES.includes(category as UploadCategory)) {
      throw new AppError(400, 'INVALID_CATEGORY', `Categoria non valida: ${category}`);
    }

    const options = UploadController.parseProcessOptions(req.body);
    const result = await UploadService.processFromUrl(url, category as UploadCategory, options);

    // Elimina la vecchia immagine se è una sostituzione
    if (oldPath) {
      await UploadService.deleteFile(oldPath);
    }

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * DELETE /api/uploads
   * Elimina un'immagine caricata
   * Body: { path: "/uploads/museums/abc123.webp" }
   */
  static deleteImage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { path } = req.body;

    if (!path) {
      throw new AppError(400, 'NO_PATH', 'Percorso file mancante');
    }

    const deleted = await UploadService.deleteFile(path);

    res.json({
      success: true,
      data: { deleted },
    });
  });

  /**
   * Estrae le opzioni di elaborazione immagine dal body della richiesta
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
