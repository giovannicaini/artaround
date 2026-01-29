import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Museum } from '../models';
import { AppError } from '../middleware';
import { AuthRequest } from '../middleware/auth.middleware';

export class MuseumController {
  // Validation rules
  static createValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('location.address').notEmpty().withMessage('Address is required'),
    body('location.city').notEmpty().withMessage('City is required'),
    body('location.country').notEmpty().withMessage('Country is required'),
  ];

  // Get all museums
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { city, isActive } = req.query;
      
      const filter: any = {};
      if (city) filter['location.city'] = city;
      if (isActive !== undefined) filter.isActive = isActive === 'true';

      const museums = await Museum.find(filter).sort({ name: 1 });

      res.json({
        success: true,
        data: museums,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get museum by ID
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get museum config
  static async getConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      if (!museum.configFile) {
        throw new AppError(404, 'CONFIG_NOT_FOUND', 'Museum configuration not available');
      }

      // Parse JSON config
      const config = JSON.parse(museum.configFile);

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  // Create museum (admin only)
  static async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const museum = new Museum(req.body);
      await museum.save();

      res.status(201).json({
        success: true,
        data: museum,
        message: 'Museum created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update museum
  static async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await Museum.findByIdAndUpdate(
        id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum,
        message: 'Museum updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete museum
  static async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await Museum.findByIdAndDelete(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        message: 'Museum deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
