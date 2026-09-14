import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/async-handler.util.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import * as backupService from '../utils/backup.service.js';

export class BackupController {
  // GET /api/admin/backups — lista snapshot esistenti, più recenti prima.
  static list = asyncHandler(async (_req: AuthRequest, res: Response): Promise<void> => {
    const backups = await backupService.listBackups();
    res.json({ success: true, data: backups });
  });

  static createValidation = [body('label').optional().isString().isLength({ max: 200 })];

  // POST /api/admin/backups — avvia in background un nuovo snapshot di
  // database + cartella uploads e risponde subito (status 'creating'): il
  // progresso si segue da GET /api/admin/backups.
  static create = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const label = typeof req.body.label === 'string' ? req.body.label : '';

    try {
      const backup = await backupService.createBackup(label, req.user.id, req.user.username);
      res.status(202).json({ success: true, data: backup });
    } catch (err) {
      throw new AppError(
        409,
        'BACKUP_ALREADY_RUNNING',
        err instanceof Error ? err.message : 'Errore sconosciuto',
      );
    }
  });

  // POST /api/admin/backups/:id/restore — ripristina database + uploads da
  // uno snapshot esistente (sovrascrive tutto lo stato attuale). Avvia in
  // background e risponde subito: il progresso si segue da GET /api/admin/backups.
  static restore = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id del backup è obbligatorio");
    }

    try {
      await backupService.restoreBackup(id);
      res.status(202).json({ success: true, message: 'Ripristino avviato' });
    } catch (err) {
      throw new AppError(
        409,
        'RESTORE_FAILED',
        err instanceof Error ? err.message : 'Errore sconosciuto',
      );
    }
  });

  // DELETE /api/admin/backups/:id — elimina uno snapshot (file su disco + voce indice).
  static remove = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id del backup è obbligatorio");
    }

    try {
      await backupService.deleteBackup(id);
      res.json({ success: true, message: 'Backup eliminato' });
    } catch (err) {
      throw new AppError(
        400,
        'DELETE_FAILED',
        err instanceof Error ? err.message : 'Errore sconosciuto',
      );
    }
  });
}
