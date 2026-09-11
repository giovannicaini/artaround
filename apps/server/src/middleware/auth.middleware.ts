import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    isAdmin: boolean;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Nessun token di autenticazione',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Toglie il prefisso 'Bearer '

    try {
      const decoded = jwt.verify(token, config.jwt.secret) as {
        id: string;
        username: string;
        email: string;
        isAdmin: boolean;
      };

      req.user = decoded;
      next();
    } catch {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Token di autenticazione non valido o scaduto',
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

// Come authMiddleware, ma per route pubbliche che si comportano diversamente
// per chi è loggato senza per questo richiederlo — nessun token, o un token
// non valido, prosegue comunque con req.user non impostato.
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.substring(7), config.jwt.secret) as AuthRequest['user'];
    } catch {
      // Token assente/scaduto: la richiesta resta pubblica, non un errore qui.
    }
  }
  next();
};
