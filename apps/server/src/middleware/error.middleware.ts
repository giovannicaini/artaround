import { Request, Response, NextFunction } from 'express';
import { APIError } from '@artaround/shared';

interface MongoServerError extends Error {
  code: number;
  keyPattern?: Record<string, unknown>;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    const error: APIError = {
      code: err.code,
      message: err.message,
      details: err.details,
    };

    res.status(err.statusCode).json({
      success: false,
      error,
    });
    return;
  }

  // Errore di validazione Mongoose
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validazione fallita',
        details: err.message,
      },
    });
    return;
  }

  // Errore di chiave duplicata Mongoose
  if (err.name === 'MongoServerError') {
    const mongoErr = err as MongoServerError;
    if (mongoErr.code === 11000) {
      res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ERROR',
          message: 'La risorsa esiste già',
          details: mongoErr.keyPattern,
        },
      });
      return;
    }
  }

  // Altri MongoServerError
  if (err.name === 'MongoServerError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: err.message,
      },
    });
    return;
  }

  // Errore di default
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Errore inaspettato del server',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
  });
};
