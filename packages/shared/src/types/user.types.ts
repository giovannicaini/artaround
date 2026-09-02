// Tipi utente
export interface User {
  _id: string;
  username: string;
  email: string;
  password: string; // hashata
  role: UserRole; // Ruolo principale/globale
  roleAssignments?: RoleAssignment[]; // Ruoli contestuali su risorse specifiche
  preferences?: UserPreferences;
  // Credito in euro spendibile nel marketplace: parte da 0, si ricarica (per ora
  // senza un pagamento reale, vedi credit.types.ts) e si consuma acquistando
  // item/visite a pagamento.
  creditBalance: number;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin', // Accesso completo al sistema
  CURATOR = 'curator', // Curatori museo che gestiscono opere e visite
  AUTHOR = 'author', // Creatori di contenuti
  VISITOR = 'visitor', // Utenti normali
}

/**
 * Assegnazione di ruolo contestuale - collega un utente a una risorsa specifica con un ruolo
 * Esempi:
 * - Utente è AUTHOR dell'Item X
 * - Utente è EDITOR della Visita Y
 * - Utente è MANAGER del Museo Z
 */
export interface RoleAssignment {
  role: ContextualRole;
  resourceType: ResourceType;
  resourceId: string;
  assignedAt: Date;
  assignedBy?: string; // ID dell'utente che ha assegnato questo ruolo
}

export enum ContextualRole {
  OWNER = 'owner', // Controllo completo sulla risorsa
  AUTHOR = 'author', // Ha creato il contenuto
  EDITOR = 'editor', // Può modificare ma non eliminare
  VIEWER = 'viewer', // Accesso in sola lettura a contenuti privati
  MANAGER = 'manager', // Può gestire (per i musei)
}

export enum ResourceType {
  ITEM = 'item',
  VISIT = 'visit',
  ARTWORK = 'artwork',
  MUSEUM = 'museum',
}

// ========================================
// USER API REQUESTS/RESPONSES
// ========================================

export interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export type RoleAssignmentData = Omit<RoleAssignment, 'assignedAt' | 'assignedBy'>;

export interface UserPreferences {
  competenceLevel: CompetenceLevel;
  interests: string[];
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
