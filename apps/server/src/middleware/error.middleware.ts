/*
 * File: /src/middleware/error.middleware.ts                                             *
 * Project: @artaround/server                                                            *
 * Last Modified: 02/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

/**
 * Gestore errori centrale: normalizza AppError e altre eccezioni in una risposta JSON coerente.
 */
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
