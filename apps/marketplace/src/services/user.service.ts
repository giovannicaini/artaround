import { apiService, getErrorMessage } from './api.service';
import type {
  User,
  UsersResponse,
  GetUsersParams,
  CreateUserData,
  UpdateUserData,
  MuseumRole,
} from '@artaround/shared';
import { __ } from './i18n.service';

class UserService {
  async getUsers(params: GetUsersParams = {}): Promise<UsersResponse> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.isAdmin !== undefined) searchParams.set('isAdmin', String(params.isAdmin));
    if (params.isActive !== undefined) searchParams.set('isActive', String(params.isActive));

    const query = searchParams.toString();
    const response = await apiService.get<UsersResponse>(`/users${query ? `?${query}` : ''}`);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare gli utenti'));
    }

    return response.data;
  }

  async getById(id: string): Promise<User> {
    const response = await apiService.get<User>(`/users/${id}`);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Utente non trovato'));
    }

    return response.data;
  }

  async create(data: CreateUserData): Promise<User> {
    const response = await apiService.post<User>('/users', data);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, "Errore nella creazione dell'utente"));
    }

    return response.data;
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    const response = await apiService.put<User>(`/users/${id}`, data);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, "Errore nell'aggiornamento dell'utente"));
    }

    return response.data;
  }

  async delete(id: string): Promise<{ message: string }> {
    const response = await apiService.delete<{ message: string }>(`/users/${id}`);

    if (!response.success) {
      throw new Error(getErrorMessage(response, "Errore nella disattivazione dell'utente"));
    }

    return { message: response.message || 'Utente disattivato' };
  }

  // Ruolo globale: è solo un booleano (User.isAdmin). Curatore/autore non
  // sono ruoli globali: si è curatore o autore solo di uno o più musei
  // specifici — vedi museumService.getCurators/addCurator/addAuthor.
  getRoleLabel(isAdmin: boolean): string {
    return isAdmin ? __('Amministratore') : __('Utente');
  }

  // Curatore/autore non sono ruoli globali: questa label è per un
  // MuseumRoleAssignment (sempre relativo a un museo specifico).
  getMuseumRoleLabel(role: MuseumRole): string {
    const labels: Record<MuseumRole, string> = {
      curator: __('Curatore'),
      author: __('Autore'),
    };
    return labels[role] || role;
  }
}

export const userService = new UserService();
