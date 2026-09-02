import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { UserRole, ContextualRole, ResourceType, RoleAssignment } from '@artaround/shared';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as UserRole;
    const isActive = req.query.isActive as string;

    const query: Record<string, unknown> = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role && Object.values(UserRole).includes(role)) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
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
    console.error('Errore nel recupero utenti:', error);
    res.status(500).json({ success: false, message: 'Errore nel recupero degli utenti' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Errore nel recupero utente:', error);
    res.status(500).json({ success: false, message: "Errore nel recupero dell'utente" });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, isActive } = req.body;

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Username, email e password sono obbligatori' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email o username già in uso' });
    }

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

    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Errore nella creazione utente:', error);
    res.status(500).json({ success: false, message: "Errore nella creazione dell'utente" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, isActive, preferences } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

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

    if (username) user.username = username;
    if (email) user.email = email.toLowerCase();
    if (role && Object.values(UserRole).includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (preferences) user.preferences = preferences;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error("Errore nell'aggiornamento utente:", error);
    res.status(500).json({ success: false, message: "Errore nell'aggiornamento dell'utente" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    if (user._id.toString() === (req as Request & { user?: { id: string } }).user?.id) {
      return res
        .status(400)
        .json({ success: false, message: 'Non puoi eliminare il tuo stesso account' });
    }

    // disattivazione, non cancellazione vera
    user.isActive = false;
    await user.save();

    res.json({ success: true, message: 'Utente disattivato con successo' });
  } catch (error) {
    console.error('Errore nella disattivazione utente:', error);
    res.status(500).json({ success: false, message: "Errore nella disattivazione dell'utente" });
  }
};

export const addRoleAssignment = async (req: Request, res: Response) => {
  try {
    const { role, resourceType, resourceId } = req.body;
    const assignedBy = (req as Request & { user?: { id: string } }).user?.id;

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

    const existingAssignment = user.roleAssignments?.find(
      (ra: RoleAssignment) =>
        ra.resourceType === resourceType && ra.resourceId === resourceId && ra.role === role,
    );

    if (existingAssignment) {
      return res
        .status(400)
        .json({ success: false, message: 'Questo ruolo è già assegnato per questa risorsa' });
    }

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

    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error("Errore nell'assegnazione ruolo:", error);
    res.status(500).json({ success: false, message: "Errore nell'assegnazione del ruolo" });
  }
};

export const removeRoleAssignment = async (req: Request, res: Response) => {
  try {
    const { role, resourceType, resourceId } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    user.roleAssignments =
      user.roleAssignments?.filter(
        (ra: RoleAssignment) =>
          !(ra.resourceType === resourceType && ra.resourceId === resourceId && ra.role === role),
      ) || [];

    await user.save();

    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Errore nella rimozione ruolo:', error);
    res.status(500).json({ success: false, message: 'Errore nella rimozione del ruolo' });
  }
};

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

    const usersWithFilteredRoles = users.map((user) => ({
      ...user,
      roleAssignments: user.roleAssignments?.filter(
        (ra: RoleAssignment) => ra.resourceType === resourceType && ra.resourceId === resourceId,
      ),
    }));

    res.json({ success: true, data: usersWithFilteredRoles });
  } catch (error) {
    console.error('Errore nel recupero utenti per risorsa:', error);
    res.status(500).json({ success: false, message: 'Errore nel recupero degli utenti' });
  }
};
