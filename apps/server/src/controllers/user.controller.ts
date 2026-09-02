import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { UserRole, ContextualRole, ResourceType, RoleAssignment } from '@artaround/shared';

/**
 * User Controller
 *
 * Handles CRUD operations for users and role assignments.
 * Only accessible by admins.
 */

// GET /users - Get all users with pagination and filters
export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as UserRole;
    const isActive = req.query.isActive as string;

    const query: Record<string, unknown> = {};

    // Search by username or email
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by role
    if (role && Object.values(UserRole).includes(role)) {
      query.role = role;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password') // Never return password
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Errore nel recupero degli utenti' });
  }
};

// GET /users/:id - Get single user by ID
export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: "Errore nel recupero dell'utente" });
  }
};

// POST /users - Create new user (admin only)
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, isActive } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Username, email e password sono obbligatori' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email o username già in uso' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || UserRole.VISITOR,
      isActive: isActive !== false,
      roleAssignments: [],
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: "Errore nella creazione dell'utente" });
  }
};

// PUT /users/:id - Update user
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, isActive, preferences } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Check for duplicate username/email (excluding current user)
    if (username || email) {
      const existingUser = await User.findOne({
        $or: [
          ...(email ? [{ email: email.toLowerCase() }] : []),
          ...(username ? [{ username }] : []),
        ],
        _id: { $ne: req.params.id },
      });

      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email o username già in uso' });
      }
    }

    // Update fields
    if (username) user.username = username;
    if (email) user.email = email.toLowerCase();
    if (role && Object.values(UserRole).includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (preferences) user.preferences = preferences;

    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: "Errore nell'aggiornamento dell'utente" });
  }
};

// DELETE /users/:id - Delete user (soft delete by deactivating)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Prevent deleting yourself
    if (user._id.toString() === (req as Request & { user?: { id: string } }).user?.id) {
      return res
        .status(400)
        .json({ success: false, message: 'Non puoi eliminare il tuo stesso account' });
    }

    // Soft delete - just deactivate
    user.isActive = false;
    await user.save();

    res.json({ success: true, message: 'Utente disattivato con successo' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: "Errore nella disattivazione dell'utente" });
  }
};

// POST /users/:id/role-assignments - Add a role assignment
export const addRoleAssignment = async (req: Request, res: Response) => {
  try {
    const { role, resourceType, resourceId } = req.body;
    const assignedBy = (req as Request & { user?: { id: string } }).user?.id;

    // Validate
    if (!role || !resourceType || !resourceId) {
      return res
        .status(400)
        .json({ success: false, message: 'Role, resourceType e resourceId sono obbligatori' });
    }

    if (!Object.values(ContextualRole).includes(role)) {
      return res.status(400).json({ success: false, message: 'Ruolo contestuale non valido' });
    }

    if (!Object.values(ResourceType).includes(resourceType)) {
      return res.status(400).json({ success: false, message: 'Tipo di risorsa non valido' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Check if assignment already exists
    const existingAssignment = user.roleAssignments?.find(
      (ra: RoleAssignment) =>
        ra.resourceType === resourceType && ra.resourceId === resourceId && ra.role === role,
    );

    if (existingAssignment) {
      return res
        .status(400)
        .json({ success: false, message: 'Questo ruolo è già assegnato per questa risorsa' });
    }

    // Add role assignment
    if (!user.roleAssignments) {
      user.roleAssignments = [];
    }

    user.roleAssignments.push({
      role,
      resourceType,
      resourceId,
      assignedAt: new Date(),
      assignedBy,
    });

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error adding role assignment:', error);
    res.status(500).json({ success: false, message: "Errore nell'assegnazione del ruolo" });
  }
};

// DELETE /users/:id/role-assignments - Remove a role assignment
export const removeRoleAssignment = async (req: Request, res: Response) => {
  try {
    const { role, resourceType, resourceId } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Remove the assignment
    user.roleAssignments =
      user.roleAssignments?.filter(
        (ra: RoleAssignment) =>
          !(ra.resourceType === resourceType && ra.resourceId === resourceId && ra.role === role),
      ) || [];

    await user.save();

    // Return user without password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error removing role assignment:', error);
    res.status(500).json({ success: false, message: 'Errore nella rimozione del ruolo' });
  }
};

// GET /users/by-resource/:resourceType/:resourceId - Get users with roles on a specific resource
export const getUsersByResource = async (req: Request, res: Response) => {
  try {
    const { resourceType, resourceId } = req.params;

    if (!Object.values(ResourceType).includes(resourceType as ResourceType)) {
      return res.status(400).json({ success: false, message: 'Tipo di risorsa non valido' });
    }

    const users = await User.find({
      'roleAssignments.resourceType': resourceType,
      'roleAssignments.resourceId': resourceId,
    })
      .select('-password')
      .lean();

    // Filter role assignments to only include the requested resource
    const usersWithFilteredRoles = users.map((user) => ({
      ...user,
      roleAssignments: user.roleAssignments?.filter(
        (ra: RoleAssignment) => ra.resourceType === resourceType && ra.resourceId === resourceId,
      ),
    }));

    res.json({ success: true, data: usersWithFilteredRoles });
  } catch (error) {
    console.error('Error getting users by resource:', error);
    res.status(500).json({ success: false, message: 'Errore nel recupero degli utenti' });
  }
};
