import { apiService, getErrorMessage } from './api.service';
import { routerService } from './router.service';
import { preferencesService } from './preferences.service';
import type {
  User,
  LoginRequest,
  RegisterRequest,
  UserPreferences,
  MuseumRoleRequest,
} from '@artaround/shared';

export type UpdateProfileData = {
  email?: string;
  preferences?: Partial<UserPreferences>;
};

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
      // Ignora i fallimenti di storage (modalità privata/quota)
    }

    routerService.reset();
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

  async updateProfile(data: UpdateProfileData): Promise<{ user: User | null; error?: string }> {
    const response = await apiService.put<User>('/auth/me', data);

    if (response.success && response.data) {
      return { user: response.data };
    }

    return { user: null, error: getErrorMessage(response, 'Aggiornamento profilo non riuscito') };
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.put('/auth/me/password', { currentPassword, newPassword });

    if (response.success) {
      return { success: true };
    }

    return { success: false, error: getErrorMessage(response, 'Cambio password non riuscito') };
  }

  // Le mie richieste di ruolo museo in attesa (vedi AuthController.myRoleRequests)
  async getMyRoleRequests(): Promise<MuseumRoleRequest[]> {
    const response = await apiService.get<MuseumRoleRequest[]>('/auth/me/role-requests');
    return response.success && response.data ? response.data : [];
  }

  logout(): void {
    localStorage.removeItem('authToken');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }
}

export const authService = new AuthService();
