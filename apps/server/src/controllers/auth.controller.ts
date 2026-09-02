import { Request, Response, NextFunction } from 'express';
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
  // Validation rules
  static registerValidation = [
    body('username')
      .trim()
      .isLength({ min: 3 })
      .withMessage('Username must be at least 3 characters'),
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['author', 'visitor']).withMessage('Invalid role'),
  ];

  static loginValidation = [
    body('username').notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ];

  // Register new user
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { username, email, password, role }: RegisterRequest = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ username }, { email }],
      });

      if (existingUser) {
        throw new AppError(409, 'USER_EXISTS', 'Username or email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: role || 'visitor',
      });

      await user.save();

      // Generate JWT
      const token = jwt.sign(
        {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
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
        message: 'User registered successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Login user
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { username, password }: LoginRequest = req.body;

      // Find user
      const user = await User.findOne({ username });
      if (!user) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
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
        message: 'Login successful',
      });
    } catch (error) {
      next(error);
    }
  }

  static updateMeValidation = [
    body('email').optional().isEmail().withMessage('Invalid email address'),
    body('preferences.competenceLevel').optional().isString(),
    body('preferences.availableTime').optional().isString(),
    body('preferences.language').optional().isString(),
    body('preferences.age').optional().isInt({ min: 0, max: 120 }),
    body('preferences.interests').optional().isArray(),
  ];

  // Self-service update of the current user's own email/preferences.
  // Deliberately separate from UserController.updateUser (admin-only,
  // PUT /api/users/:id): here nobody can touch role, roleAssignments,
  // username or isActive, regardless of what the request body contains.
  static async updateMe(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { email, preferences } = req.body as {
        email?: string;
        preferences?: Partial<{
          competenceLevel: CompetenceLevel;
          interests: string[];
          availableTime: TimePreference;
          age: number;
          language: string;
        }>;
      };

      if (email) {
        const existing = await User.findOne({ email, _id: { $ne: req.user.id } });
        if (existing) {
          throw new AppError(409, 'EMAIL_TAKEN', 'Email already in use');
        }
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      if (email) {
        user.email = email;
      }

      if (preferences) {
        const currentPreferences = user.preferences ?? {
          competenceLevel: CompetenceLevel.MEDIO,
          interests: [],
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
        message: 'Profile updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static changePasswordValidation = [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ];

  // Self-service password change: requires the current password, never touches
  // any other user via id (unlike the admin-only user CRUD).
  static async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { currentPassword, newPassword } = req.body as {
        currentPassword: string;
        newPassword: string;
      };

      const user = await User.findById(req.user.id);
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get current user
  static async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
      }

      const user = await User.findById(req.user.id).select('-password');
      if (!user) {
        throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
}
