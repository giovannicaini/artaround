import { apiService, getErrorMessage } from './api.service';
import type {
  User,
  UsersResponse,
  GetUsersParams,
  CreateUserData,
  UpdateUserData,
  RoleAssignmentData,
  ResourceType,
  UserRole,
  ContextualRole,
} from '@artaround/shared';
import { __ } from './i18n.service';

class UserService {
  async getUsers(params: GetUsersParams = {}): Promise<UsersResponse> {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.search) searchParams.set('search', params.search);
    if (params.role) searchParams.set('role', params.role);
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

  async addRoleAssignment(userId: string, data: RoleAssignmentData): Promise<User> {
    const response = await apiService.post<User>(`/users/${userId}/role-assignments`, data);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, "Errore nell'assegnazione del ruolo"));
    }

    return response.data;
  }

  async removeRoleAssignment(userId: string, data: RoleAssignmentData): Promise<User> {
    const response = await apiService.deleteWithBody<User>(
      `/users/${userId}/role-assignments`,
      data,
    );

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Errore nella rimozione del ruolo'));
    }

    return response.data;
  }

  async getUsersByResource(resourceType: ResourceType, resourceId: string): Promise<User[]> {
    const response = await apiService.get<User[]>(
      `/users/by-resource/${resourceType}/${resourceId}`,
    );

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Errore nel recupero degli utenti'));
    }

    return response.data;
  }

  getRoleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      admin: __('Amministratore'),
      curator: __('Curatore'),
      author: __('Autore'),
      visitor: __('Visitatore'),
    };
    return labels[role] || role;
  }

  getContextualRoleLabel(role: ContextualRole): string {
    const labels: Record<ContextualRole, string> = {
      owner: __('Proprietario'),
      author: __('Autore'),
      editor: __('Editor'),
      viewer: __('Visualizzatore'),
      manager: 'Gestore',
    };
    return labels[role] || role;
  }

  getResourceTypeLabel(type: ResourceType): string {
    const labels: Record<ResourceType, string> = {
      item: __('Contenuto'),
      visit: __('Visita'),
      artwork: __('Opera'),
      museum: __('Museo'),
    };
    return labels[type] || type;
  }
}

export const userService = new UserService();
