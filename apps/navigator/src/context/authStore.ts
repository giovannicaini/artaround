/*
 * File: /src/context/authStore.ts                                                       *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

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

// sia login che register: chiama API, salva token+utente, eventuali errori
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

// Sessione utente, token condiviso con il marketplace via localStorage: un login unico
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
