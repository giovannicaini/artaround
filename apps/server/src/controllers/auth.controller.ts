/*
 * File: /src/controllers/auth.controller.ts                                             *
 * Project: @artaround/server                                                            *
 * Last Modified: 12/09/2026                                                             *
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
 * Registrazione, login e recupero dell'utente autenticato corrente.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.util.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { config } from '../config/config.js';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  CompetenceLevel,
  TimePreference,
} from '@artaround/shared';
import { AuthRequest } from '../middleware/auth.middleware.js';

export class AuthController {
  // Regole di validazione
  static registerValidation = [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage("L'username deve avere almeno 3 caratteri"),
    body('email').isEmail().withMessage('Indirizzo email non valido'),
    body('password').isLength({ min: 8 }).withMessage('La password deve avere almeno 8 caratteri'),
  ];

  static loginValidation = [
    body('username').notEmpty().withMessage("L'username è obbligatorio"),
    body('password').notEmpty().withMessage('La password è obbligatoria'),
  ];

  // POST /api/auth/register — crea l'utente (visitor di default) e restituisce il JWT
  static register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { username, email, password }: RegisterRequest = req.body;

    // Controlla se l'utente esiste già
    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      throw new AppError(409, 'USER_EXISTS', 'Username o email già esistenti');
    }

    // Hasha la password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Chi si autoregistra non è mai admin, e non esiste un CURATOR/AUTHOR
    // generico da poter scegliere in fase di registrazione (vedi
    // policy.util.ts) — diventa autore/curatore di un museo solo se
    // promosso da un admin o dal curatore di quel museo.
    const user = new User({
      username,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Genera il JWT
    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
      config.jwt.secret,
      { expiresIn: '7d' },
    );

    const safeUser = { ...user.toObject(), _id: user._id.toString() };
    delete (safeUser as { password?: string }).password;

    const response: AuthResponse = { token, user: safeUser };

    res.status(201).json({
      success: true,
      data: response,
      message: 'Utente registrato con successo',
    });
  });

  // POST /api/auth/login — verifica le credenziali e rilascia il JWT
  static login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { username, password }: LoginRequest = req.body;

    // Trova l'utente
    const user = await User.findOne({ username });
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Username o password non validi');
    }

    // Controlla la password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Username o password non validi');
    }

    user.lastLogin = new Date();
    await user.save();

    // Genera il JWT
    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
      },
      config.jwt.secret,
      { expiresIn: '7d' },
    );

    const safeUser = { ...user.toObject(), _id: user._id.toString() };
    delete (safeUser as { password?: string }).password;

    const response: AuthResponse = { token, user: safeUser };

    res.json({
      success: true,
      data: response,
      message: 'Login effettuato con successo',
    });
  });

  static updateMeValidation = [
    body('email').optional().isEmail().withMessage('Indirizzo email non valido'),
    body('preferences.competenceLevel').optional().isString(),
    body('preferences.availableTime').optional().isString(),
    body('preferences.language').optional().isString(),
    body('preferences.age').optional().isInt({ min: 0, max: 120 }),
  ];

  // PUT /api/auth/me — aggiornamento self-service di email/preferenze proprie.
  static updateMe = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { email, preferences } = req.body as {
      email?: string;
      preferences?: Partial<{
        competenceLevel: CompetenceLevel;
        availableTime: TimePreference;
        age: number;
        language: string;
      }>;
    };

    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
      if (existing) {
        throw new AppError(409, 'EMAIL_TAKEN', 'Email già in uso');
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    if (email) {
      user.email = email;
    }

    if (preferences) {
      const currentPreferences = user.preferences ?? {
        competenceLevel: CompetenceLevel.MEDIO,
        availableTime: TimePreference.NORMALE,
        language: 'it',
      };
      user.preferences = { ...currentPreferences, ...preferences };
    }

    await user.save();

    const safeUser = user.toObject();
    delete (safeUser as { password?: string }).password;

    res.json({
      success: true,
      data: safeUser,
      message: 'Profilo aggiornato con successo',
    });
  });

  static changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('La password attuale è obbligatoria'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('La nuova password deve avere almeno 8 caratteri'),
  ];

  // PUT /api/auth/me/password — cambio password self-service
  static changePassword = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await User.findById(req.user.id);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'La password attuale non è corretta');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({
      success: true,
      message: 'Password modificata con successo',
    });
  });

  // GET /api/auth/me — profilo dell'utente autenticato
  static me = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Utente non trovato');
    }

    res.json({
      success: true,
      data: user,
    });
  });

  // GET /api/auth/me/role-requests — le mie richieste di ruolo museo in attesa
  static myRoleRequests = asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Autenticazione richiesta');
    }

    const { MuseumRoleRequestModel } = await import('../models/index.js');
    const requests = await MuseumRoleRequestModel.find({ userId: req.user.id })
      .sort({ requestedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: requests,
    });
  });
}
