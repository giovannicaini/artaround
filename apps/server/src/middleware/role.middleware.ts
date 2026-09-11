import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware.js';

/**
 * Controllo "piatto" per le operazioni riservate all'amministratore (unico
 * ruolo globale oltre al normale utente — vedi User.isAdmin). Per tutto ciò
 * che dipende da QUALE museo/risorsa (es. "curatore di questo museo"), vedi
 * invece policy.util.ts (can/assertCan/authorizeResource/authorizeCreate),
 * che è l'unico posto dove vive quella logica.
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Autenticazione richiesta. Effettua il login.',
      },
    });
    return;
  }

  if (!req.user.isAdmin) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message:
          'Non hai i permessi per eseguire questa operazione. Serve un account amministratore.',
      },
    });
    return;
  }

  next();
};
