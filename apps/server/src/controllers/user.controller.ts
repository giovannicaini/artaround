import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { UserRole, ContextualRole, ResourceType, RoleAssignment } from '@artaround/shared';

/**
 * Controller Utenti
 *
 * Gestisce le operazioni CRUD per utenti e assegnazioni di ruolo.
 * Accessibile solo dagli admin.
 */

// GET /users - Ottieni tutti gli utenti con paginazione e filtri
export const getUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as UserRole;
    const isActive = req.query.isActive as string;

    const query: Record<string, unknown> = {};

    // Cerca per username o email
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    // Filtra per ruolo
    if (role && Object.values(UserRole).includes(role)) {
      query.role = role;
    }

    // Filtra per stato attivo
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

// GET /users/:id - Ottieni un singolo utente per ID
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

// POST /users - Crea nuovo utente (solo admin)
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, isActive } = req.body;

    // Valida i campi obbligatori
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Username, email e password sono obbligatori' });
    }

    // Controlla se l'utente esiste già
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email o username già in uso' });
    }

    // Hasha la password
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

    // Restituisce l'utente senza password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.status(201).json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, message: "Errore nella creazione dell'utente" });
  }
};

// PUT /users/:id - Aggiorna utente
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, role, isActive, preferences } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Controlla duplicati di username/email (escluso l'utente corrente)
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

    // Aggiorna i campi
    if (username) user.username = username;
    if (email) user.email = email.toLowerCase();
    if (role && Object.values(UserRole).includes(role)) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (preferences) user.preferences = preferences;

    // Aggiorna la password se fornita
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    await user.save();

    // Restituisce l'utente senza password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: "Errore nell'aggiornamento dell'utente" });
  }
};

// DELETE /users/:id - Elimina utente (soft delete disattivandolo)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Impedisce di eliminare se stessi
    if (user._id.toString() === (req as Request & { user?: { id: string } }).user?.id) {
      return res
        .status(400)
        .json({ success: false, message: 'Non puoi eliminare il tuo stesso account' });
    }

    // Soft delete - si limita a disattivare
    user.isActive = false;
    await user.save();

    res.json({ success: true, message: 'Utente disattivato con successo' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, message: "Errore nella disattivazione dell'utente" });
  }
};

// POST /users/:id/role-assignments - Aggiungi un'assegnazione di ruolo
export const addRoleAssignment = async (req: Request, res: Response) => {
  try {
    const { role, resourceType, resourceId } = req.body;
    const assignedBy = (req as Request & { user?: { id: string } }).user?.id;

    // Valida
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

    // Controlla se l'assegnazione esiste già
    const existingAssignment = user.roleAssignments?.find(
      (ra: RoleAssignment) =>
        ra.resourceType === resourceType && ra.resourceId === resourceId && ra.role === role,
    );

    if (existingAssignment) {
      return res
        .status(400)
        .json({ success: false, message: 'Questo ruolo è già assegnato per questa risorsa' });
    }

    // Aggiungi l'assegnazione di ruolo
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

    // Restituisce l'utente senza password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error adding role assignment:', error);
    res.status(500).json({ success: false, message: "Errore nell'assegnazione del ruolo" });
  }
};

// DELETE /users/:id/role-assignments - Rimuovi un'assegnazione di ruolo
export const removeRoleAssignment = async (req: Request, res: Response) => {
  try {
    const { role, resourceType, resourceId } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utente non trovato' });
    }

    // Rimuove l'assegnazione
    user.roleAssignments =
      user.roleAssignments?.filter(
        (ra: RoleAssignment) =>
          !(ra.resourceType === resourceType && ra.resourceId === resourceId && ra.role === role),
      ) || [];

    await user.save();

    // Restituisce l'utente senza password
    const userResponse = user.toObject();
    delete (userResponse as unknown as Record<string, unknown>).password;

    res.json({ success: true, data: userResponse });
  } catch (error) {
    console.error('Error removing role assignment:', error);
    res.status(500).json({ success: false, message: 'Errore nella rimozione del ruolo' });
  }
};

// GET /users/by-resource/:resourceType/:resourceId - Ottieni gli utenti con ruoli su una risorsa specifica
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

    // Filtra le assegnazioni di ruolo per includere solo la risorsa richiesta
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
