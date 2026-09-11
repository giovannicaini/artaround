import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/async-handler.util.js';
import { parsePagination, buildPaginationMeta } from '../utils/pagination.util.js';
import { User } from '../models/User.js';
import { AppError } from '../middleware/index.js';

/**
 * Controller Utenti
 *
 * Gestisce le operazioni CRUD sugli utenti. Ruolo globale (isAdmin: true/false)
 * gestito solo qui, da un admin. Non esiste un CURATOR o un AUTHOR generico:
 * chi cura o scrive contenuti per un museo lo è solo per quel museo
 * specifico — vedi MuseumController.addCurator/addAuthor.
 * Accessibile solo dagli admin (vedi user.routes.ts).
 */

// Regole di validazione per la creazione (usate da POST /api/users)
export const createUserValidation = [
  body('username').trim().notEmpty().withMessage("L'username è obbligatorio"),
  body('email').isEmail().withMessage('Indirizzo email non valido'),
  body('password').isLength({ min: 8 }).withMessage('La password deve avere almeno 8 caratteri'),
  body('isAdmin').optional().isBoolean().withMessage('isAdmin deve essere un booleano'),
  body('isActive').optional().isBoolean().withMessage('isActive deve essere un booleano'),
];

// Regole di validazione per l'aggiornamento (usate da PUT /api/users/:id):
// stessi campi della creazione, ma tutti opzionali visto che è un update parziale
export const updateUserValidation = [
  body('username').optional().trim().notEmpty().withMessage("L'username non può essere vuoto"),
  body('email').optional().isEmail().withMessage('Indirizzo email non valido'),
  body('password')
    .optional()
    .isLength({ min: 8 })
    .withMessage('La password deve avere almeno 8 caratteri'),
  body('isAdmin').optional().isBoolean().withMessage('isAdmin deve essere un booleano'),
  body('isActive').optional().isBoolean().withMessage('isActive deve essere un booleano'),
];

// GET /users - Ottieni tutti gli utenti con paginazione e filtri
export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, skip } = parsePagination(req.query);
  const search = req.query.search as string;
  const isAdmin = req.query.isAdmin as string;
  const isActive = req.query.isActive as string;

  const query: Record<string, unknown> = {};

  // Cerca per username o email
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  // Filtra per ruolo globale
  if (isAdmin !== undefined) {
    query.isAdmin = isAdmin === 'true';
  }

  // Filtra per stato attivo
  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

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
      pagination: buildPaginationMeta(total, page, limit),
    },
  });
});

// GET /users/:id - Ottieni un singolo utente per ID
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select('-password').lean();

  if (!user) {
    return res.status(404).json({ success: false, message: 'Utente non trovato' });
  }

  res.json({ success: true, data: user });
});

// POST /users - Crea nuovo utente (solo admin)
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
  }

  const { username, email, password, isAdmin, isActive } = req.body;

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
    isAdmin: isAdmin === true,
    isActive: isActive !== false,
    museumRoles: [],
  });

  await user.save();

  // Restituisce l'utente senza password
  const userResponse = user.toObject();
  delete (userResponse as unknown as Record<string, unknown>).password;

  res.status(201).json({ success: true, data: userResponse });
});

// PUT /users/:id - Aggiorna utente
export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Validazione fallita', errors.array());
  }

  const { username, email, password, isAdmin, isActive, preferences } = req.body;

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
  if (typeof isAdmin === 'boolean') user.isAdmin = isAdmin;
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
});

// DELETE /users/:id - Elimina utente (soft delete disattivandolo)
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
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
});
