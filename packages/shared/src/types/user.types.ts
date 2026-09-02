export interface User {
  _id: string;
  username: string;
  email: string;
  password: string; // hashata
  role: UserRole; // ruolo globale
  roleAssignments?: RoleAssignment[]; // ruoli su singole risorse
  preferences?: UserPreferences;
  creditBalance: number; // credito in euro, parte da 0
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  CURATOR = 'curator', // gestisce opere e visite di un museo
  AUTHOR = 'author', // crea contenuti
  VISITOR = 'visitor',
}

// collega un utente a una risorsa specifica con un ruolo, es. autore
// dell'item X, editor della visita Y, manager del museo Z
export interface RoleAssignment {
  role: ContextualRole;
  resourceType: ResourceType;
  resourceId: string;
  assignedAt: Date;
  assignedBy?: string;
}

export enum ContextualRole {
  OWNER = 'owner',
  AUTHOR = 'author',
  EDITOR = 'editor', // può modificare ma non cancellare
  VIEWER = 'viewer', // solo lettura su contenuti privati
  MANAGER = 'manager',
}

export enum ResourceType {
  ITEM = 'item',
  VISIT = 'visit',
  ARTWORK = 'artwork',
  MUSEUM = 'museum',
}

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
