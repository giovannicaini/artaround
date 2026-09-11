import { Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import * as notificationsService from '../utils/notifications.service.js';

// Notifiche in-app dell'utente autenticato (vedi notifications.service.ts).
export class NotificationController {
  // GET /api/notifications — le proprie, più recenti prima.
  static list = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const notifications = await notificationsService.listForUser(req.user.id);

    res.json({ success: true, data: notifications });
  });

  // POST /api/notifications/:id/read
  static markRead = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;

    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }
    if (!id) {
      throw new AppError(400, 'VALIDATION_ERROR', "L'id della notifica è obbligatorio");
    }

    await notificationsService.markRead(id, req.user.id);

    res.json({ success: true });
  });

  // POST /api/notifications/read-all
  static markAllRead = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    await notificationsService.markAllRead(req.user.id);

    res.json({ success: true });
  });
}
