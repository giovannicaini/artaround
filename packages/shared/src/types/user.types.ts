/**
 * Tipi Utente
 */
export interface User {
  _id: string;
  username: string;
  email: string;
  password: string; // hashata
  isAdmin: boolean; // Unico ruolo globale: amministratore o no
  museumRoles?: MuseumRoleAssignment[]; // Musei di cui è curatore o autore
  preferences?: UserPreferences; // Preferenze settate sul navigator
  creditBalance: number; //non dovrebbe mai andare in negativo
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Assegna un utente come curatore o autore di UN museo specifico. Non esiste
 * un CURATOR o un AUTHOR "generici": lo si è sempre e solo di un museo preciso.
 * - CURATOR: assegnabile solo da un admin (vedi MuseumController.addCurator).
 * - AUTHOR: assegnabile da un admin, oppure dal CURATOR di quello stesso museo
 *   per promuovere un utente già a sistema (vedi MuseumController.addAuthor).
 */
export interface MuseumRoleAssignment {
  museumId: string;
  role: MuseumRole;
  assignedAt: Date;
  assignedBy?: string; // ID dell'utente che ha assegnato questo ruolo
}

export enum MuseumRole {
  CURATOR = 'curator',
  AUTHOR = 'author',
}

/**
 * Richiesta di un utente di diventare curatore o autore di un museo — in
 * attesa che un admin (sempre) o il curatore del museo (solo per AUTHOR)
 * la confermi. Vedi MuseumController.requestRole/approveRoleRequest.
 */
export interface MuseumRoleRequest {
  _id: string;
  userId: string;
  museumId: string;
  role: MuseumRole;
  requestedAt: Date;
}

/**
 * MuseumRoleRequest con username e nome museo già risolti — così chi
 * revisiona (un curatore non ha accesso a GET /api/users) non deve fare
 * chiamate aggiuntive per capire chi/cosa. Vedi
 * MuseumController.listReviewableRoleRequests.
 */
export interface MuseumRoleRequestWithNames extends MuseumRoleRequest {
  username?: string;
  museumName?: string;
}

// ========================================
// RICHIESTE/RISPOSTE API UTENTE
// ========================================

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  password?: string;
  isAdmin?: boolean;
  isActive?: boolean;
}

export interface UserPreferences {
  competenceLevel: CompetenceLevel;
  availableTime: TimePreference;
  age?: number;
  language: string;
}

export enum CompetenceLevel {
  INFANTILE = 'infantile',
  SEMPLICE = 'semplice',
  MEDIO = 'medio',
  AVANZATO = 'avanzato',
}

export enum TimePreference {
  VELOCE = 'veloce', // 30-45 min
  NORMALE = 'normale', // 1-2 ore
  APPROFONDITO = 'approfondito', // 2+ ore
}
