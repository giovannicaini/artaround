import { create } from 'zustand';
import type { User, LoginRequest, RegisterRequest, UserPreferences } from '@artaround/shared';
import { api, getToken, setToken, clearToken } from '../services/apiClient';

interface AuthState {
  user: User | null;
  status: 'idle' | 'loading' | 'ready';
  error: string | null;
  hydrate: () => Promise<void>;
  login: (credentials: LoginRequest) => Promise<{ ok: boolean; error?: string }>;
  register: (data: RegisterRequest) => Promise<{ ok: boolean; error?: string }>;
  updatePreferences: (
    preferences: Partial<UserPreferences>,
  ) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

// login e register hanno la stessa forma (chiama l'API, salva token+utente, gestisce l'errore) —
// condivisa qui invece di duplicata.
async function authenticate(
  set: (partial: Partial<AuthState>) => void,
  action: () => Promise<{ user: User; token: string }>,
  fallbackError: string,
): Promise<{ ok: boolean; error?: string }> {
  set({ status: 'loading', error: null });
  try {
    const { user, token } = await action();
    setToken(token);
    set({ user, status: 'ready' });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : fallbackError;
    set({ status: 'ready', error: message });
    return { ok: false, error: message };
  }
}

/** Sessione utente, unico store per tutta l'app — token condiviso con il marketplace via localStorage. */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  hydrate: async () => {
    const token = getToken();
    if (!token) {
      set({ status: 'ready' });
      return;
    }
    set({ status: 'loading' });
    try {
      const user = await api.me();
      set({ user, status: 'ready', error: null });
    } catch {
      clearToken();
      set({ user: null, status: 'ready' });
    }
  },

  login: (credentials) => authenticate(set, () => api.login(credentials), 'Accesso non riuscito'),

  register: (data) => authenticate(set, () => api.register(data), 'Registrazione non riuscita'),

  updatePreferences: async (preferences) => {
    try {
      const user = await api.updatePreferences(preferences);
      set({ user });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Salvataggio non riuscito';
      return { ok: false, error: message };
    }
  },

  logout: () => {
    clearToken();
    set({ user: null });
  },
}));
