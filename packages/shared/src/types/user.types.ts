// User types
export interface User {
  _id: string;
  username: string;
  email: string;
  password: string; // hashed
  role: UserRole;
  preferences?: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  AUTHOR = 'author',
  VISITOR = 'visitor',
  ADMIN = 'admin'
}

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
  AVANZATO = 'avanzato'
}

export enum TimePreference {
  VELOCE = 'veloce',      // 30-45 min
  NORMALE = 'normale',     // 1-2 ore
  APPROFONDITO = 'approfondito' // 2+ ore
}
