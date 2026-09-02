import type { User } from './user.types';

// Tipi risposta API
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  message?: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Tipi autenticazione
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role?: string;
}

// Utente restituito da login/register: l'intero documento tranne la
// password — prima era un sottoinsieme scelto a mano ({id, username,
// email, role}) che ometteva preferences (e usava "id" invece di "_id",
// disallineato dal resto dell'app), costringendo un'altra chiamata a
// /auth/me subito dopo il login solo per leggere le preferenze salvate.
export interface AuthResponse {
  token: string;
  user: Omit<User, 'password'>;
}

// API traduzione
export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranslationResponse {
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

// Comando vocale
export interface VoiceCommand {
  command: string;
  rawInput: string;
  confidence?: number;
}

export interface CommandInterpreter {
  interpret(input: string): Promise<VoiceCommand>;
}
