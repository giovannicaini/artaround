import { apiService } from './api.service';
import { historyService } from './history.service';
import { preferencesService } from './preferences.service';
import type { User, LoginRequest, RegisterRequest } from '@artaround/shared';

export class AuthService {
  private static readonly PRESERVED_STORAGE_KEYS = ['theme', 'accessibility'];

  private resetStorageForFreshLogin(): void {
    try {
      const preservedEntries = AuthService.PRESERVED_STORAGE_KEYS.map(
        (key) => [key, localStorage.getItem(key)] as const,
      );

      localStorage.clear();

      for (const [key, value] of preservedEntries) {
        if (value !== null) {
          localStorage.setItem(key, value);
        }
      }
    } catch {
      // Ignore storage failures (private mode/quota issues)
    }

    historyService.clear();
    preferencesService.clearSelectedMuseum();
  }

  async login(credentials: LoginRequest): Promise<User | null> {
    const response = await apiService.post<{ user: User; token: string }>(
      '/auth/login',
      credentials,
    );

    if (response.success && response.data) {
      this.resetStorageForFreshLogin();
      localStorage.setItem('authToken', response.data.token);
      return response.data.user;
    }

    return null;
  }

  async register(data: RegisterRequest): Promise<User | null> {
    const response = await apiService.post<{ user: User; token: string }>('/auth/register', data);

    if (response.success && response.data) {
      localStorage.setItem('authToken', response.data.token);
      return response.data.user;
    }

    return null;
  }

  async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('authToken');
    if (!token) return null;

    const response = await apiService.get<User>('/auth/me');

    if (response.success && response.data) {
      return response.data;
    }

    // Token non valido, rimuovilo
    this.logout();
    return null;
  }

  logout(): void {
    localStorage.removeItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }
}

export const authService = new AuthService();
