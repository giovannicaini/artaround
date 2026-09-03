import { Request, Response, NextFunction } from 'express';

/**
 * Avvolge un handler async di Express: se la Promise viene rifiutata,
 * l'errore viene inoltrato automaticamente a next() (che lo passa a
 * errorHandler in error.middleware.ts). Evita di ripetere try/catch
 * identici in ogni controller.
 */
export const asyncHandler =
  <Req extends Request = Request>(fn: (req: Req, res: Response) => Promise<unknown>) =>
  (req: Req, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res)).catch(next);
  };
