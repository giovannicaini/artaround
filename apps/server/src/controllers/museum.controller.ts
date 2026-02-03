import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { Museum } from '../models/index.js';
import { AppError } from '../middleware/index.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import {
  MuseumFloor,
  MapMarker,
  FloorConnection,
  MarkerType,
  ConnectionType,
} from '@artaround/shared';

export class MuseumController {
  // Validation rules
  static createValidation = [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('location.address').notEmpty().withMessage('Address is required'),
    body('location.city').notEmpty().withMessage('City is required'),
    body('location.country').notEmpty().withMessage('Country is required'),
  ];

  static floorValidation = [
    body('id').trim().notEmpty().withMessage('Floor ID is required'),
    body('name').trim().notEmpty().withMessage('Floor name is required'),
    body('level').isNumeric().withMessage('Floor level must be a number'),
    body('svgContent').trim().notEmpty().withMessage('SVG content is required'),
    body('dimensions.width').isNumeric().withMessage('Width is required'),
    body('dimensions.height').isNumeric().withMessage('Height is required'),
  ];

  static markerValidation = [
    body('id').trim().notEmpty().withMessage('Marker ID is required'),
    body('floorId').trim().notEmpty().withMessage('Floor ID is required'),
    body('x').isNumeric().withMessage('X coordinate is required'),
    body('y').isNumeric().withMessage('Y coordinate is required'),
    body('type')
      .isIn(Object.values(MarkerType))
      .withMessage('Invalid marker type'),
  ];

  static connectionValidation = [
    body('id').trim().notEmpty().withMessage('Connection ID is required'),
    body('type')
      .isIn(Object.values(ConnectionType))
      .withMessage('Invalid connection type'),
    body('x').isNumeric().withMessage('X coordinate is required'),
    body('y').isNumeric().withMessage('Y coordinate is required'),
    body('targetFloorId').trim().notEmpty().withMessage('Target floor ID is required'),
  ];

  // Get all museums
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { city, isActive } = req.query;

      const filter: Record<string, unknown> = {};
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

      const museum = await Museum.findByIdAndUpdate(id, req.body, {
        new: true,
        runValidators: true,
      });

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

  // ========================================
  // FLOOR MANAGEMENT
  // ========================================

  // Get all floors for a museum
  static async getFloors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      res.json({
        success: true,
        data: museum.floors || [],
      });
    } catch (error) {
      next(error);
    }
  }

  // Get a specific floor
  static async getFloor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floor = museum.floors?.find((f) => f.id === floorId);
      if (!floor) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      res.json({
        success: true,
        data: floor,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add a new floor
  static async addFloor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id } = req.params;
      const floorData: MuseumFloor = {
        ...req.body,
        markers: req.body.markers || [],
        connections: req.body.connections || [],
      };

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      // Check if floor ID already exists
      if (museum.floors?.some((f) => f.id === floorData.id)) {
        throw new AppError(400, 'FLOOR_EXISTS', 'A floor with this ID already exists');
      }

      // Initialize floors array if needed
      if (!museum.floors) {
        museum.floors = [];
      }

      museum.floors.push(floorData);
      
      // Sort floors by level
      museum.floors.sort((a, b) => a.level - b.level);
      
      await museum.save();

      res.status(201).json({
        success: true,
        data: floorData,
        message: 'Floor added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update a floor
  static async updateFloor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Update floor data, preserving markers and connections if not provided
      const existingFloor = museum.floors![floorIndex];
      museum.floors![floorIndex] = {
        ...existingFloor,
        ...req.body,
        id: floorId, // Prevent ID change
        markers: req.body.markers || existingFloor.markers,
        connections: req.body.connections || existingFloor.connections,
      };

      // Re-sort floors by level
      museum.floors!.sort((a, b) => a.level - b.level);

      await museum.save();

      res.json({
        success: true,
        data: museum.floors![floorIndex],
        message: 'Floor updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a floor
  static async deleteFloor(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      museum.floors!.splice(floorIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Floor deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // MARKER MANAGEMENT
  // ========================================

  // Get all markers for a floor
  static async getMarkers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floor = museum.floors?.find((f) => f.id === floorId);
      if (!floor) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      res.json({
        success: true,
        data: floor.markers || [],
      });
    } catch (error) {
      next(error);
    }
  }

  // Add a marker to a floor
  static async addMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id, floorId } = req.params;
      const markerData: MapMarker = {
        ...req.body,
        floorId,
        isVisible: req.body.isVisible !== false,
      };

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Check if marker ID already exists on this floor
      if (museum.floors![floorIndex].markers?.some((m) => m.id === markerData.id)) {
        throw new AppError(400, 'MARKER_EXISTS', 'A marker with this ID already exists');
      }

      if (!museum.floors![floorIndex].markers) {
        museum.floors![floorIndex].markers = [];
      }

      museum.floors![floorIndex].markers!.push(markerData);
      await museum.save();

      res.status(201).json({
        success: true,
        data: markerData,
        message: 'Marker added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Update a marker
  static async updateMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId, markerId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      const markerIndex = museum.floors![floorIndex].markers?.findIndex(
        (m) => m.id === markerId
      );
      if (markerIndex === undefined || markerIndex === -1) {
        throw new AppError(404, 'MARKER_NOT_FOUND', 'Marker not found');
      }

      museum.floors![floorIndex].markers![markerIndex] = {
        ...museum.floors![floorIndex].markers![markerIndex],
        ...req.body,
        id: markerId, // Prevent ID change
        floorId, // Ensure floor ID stays correct
      };

      await museum.save();

      res.json({
        success: true,
        data: museum.floors![floorIndex].markers![markerIndex],
        message: 'Marker updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a marker
  static async deleteMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId, markerId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      const markerIndex = museum.floors![floorIndex].markers?.findIndex(
        (m) => m.id === markerId
      );
      if (markerIndex === undefined || markerIndex === -1) {
        throw new AppError(404, 'MARKER_NOT_FOUND', 'Marker not found');
      }

      museum.floors![floorIndex].markers!.splice(markerIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Marker deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk update markers (for drag & drop repositioning)
  static async updateMarkers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId } = req.params;
      const { markers } = req.body;

      if (!Array.isArray(markers)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Markers must be an array');
      }

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Replace all markers with the new array
      museum.floors![floorIndex].markers = markers.map((m: Partial<MapMarker>) => ({
        ...m,
        floorId,
      } as MapMarker));

      await museum.save();

      res.json({
        success: true,
        data: museum.floors![floorIndex].markers,
        message: 'Markers updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================

  // Add a connection between floors
  static async addConnection(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', errors.array());
      }

      const { id, floorId } = req.params;
      const connectionData: FloorConnection = {
        ...req.body,
        isAccessible: req.body.isAccessible || false,
      };

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      // Check target floor exists
      if (!museum.floors?.some((f) => f.id === connectionData.targetFloorId)) {
        throw new AppError(400, 'TARGET_FLOOR_NOT_FOUND', 'Target floor not found');
      }

      if (!museum.floors![floorIndex].connections) {
        museum.floors![floorIndex].connections = [];
      }

      museum.floors![floorIndex].connections!.push(connectionData);
      await museum.save();

      res.status(201).json({
        success: true,
        data: connectionData,
        message: 'Connection added successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete a connection
  static async deleteConnection(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, floorId, connectionId } = req.params;

      const museum = await Museum.findById(id);
      if (!museum) {
        throw new AppError(404, 'MUSEUM_NOT_FOUND', 'Museum not found');
      }

      const floorIndex = museum.floors?.findIndex((f) => f.id === floorId);
      if (floorIndex === undefined || floorIndex === -1) {
        throw new AppError(404, 'FLOOR_NOT_FOUND', 'Floor not found');
      }

      const connectionIndex = museum.floors![floorIndex].connections?.findIndex(
        (c) => c.id === connectionId
      );
      if (connectionIndex === undefined || connectionIndex === -1) {
        throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection not found');
      }

      museum.floors![floorIndex].connections!.splice(connectionIndex, 1);
      await museum.save();

      res.json({
        success: true,
        message: 'Connection deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}
