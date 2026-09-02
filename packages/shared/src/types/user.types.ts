// User types
export interface User {
  _id: string;
  username: string;
  email: string;
  password: string; // hashed
  role: UserRole; // Primary/global role
  roleAssignments?: RoleAssignment[]; // Contextual roles for specific resources
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
  ADMIN = 'admin', // Full system access
  CURATOR = 'curator', // Museum curators who can manage artworks and visits
  AUTHOR = 'author', // Content creators
  VISITOR = 'visitor', // Regular users
}

/**
 * Contextual role assignment - links a user to a specific resource with a role
 * Examples:
 * - User is AUTHOR of Item X
 * - User is EDITOR of Visit Y
 * - User is MANAGER of Museum Z
 */
export interface RoleAssignment {
  role: ContextualRole;
  resourceType: ResourceType;
  resourceId: string;
  assignedAt: Date;
  assignedBy?: string; // User ID who assigned this role
}

export enum ContextualRole {
  OWNER = 'owner', // Full control over the resource
  AUTHOR = 'author', // Created the content
  EDITOR = 'editor', // Can edit but not delete
  VIEWER = 'viewer', // Read-only access to private content
  MANAGER = 'manager', // Can manage (for museums)
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
