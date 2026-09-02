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

// il token vive in localStorage sotto la stessa chiave del marketplace
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

  login: async (credentials) => {
    set({ status: 'loading', error: null });
    try {
      const { user, token } = await api.login(credentials);
      setToken(token);
      set({ user, status: 'ready' });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Accesso non riuscito';
      set({ status: 'ready', error: message });
      return { ok: false, error: message };
    }
  },

  register: async (data) => {
    set({ status: 'loading', error: null });
    try {
      const { user, token } = await api.register(data);
      setToken(token);
      set({ user, status: 'ready' });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registrazione non riuscita';
      set({ status: 'ready', error: message });
      return { ok: false, error: message };
    }
  },

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
