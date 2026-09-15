/*
 * File: /src/services/user.service.ts                                                   *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

/**
 * CRUD utenti e assegnazione di ruoli museo (curatore/autore).
 */
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

  // Ruolo globale: è solo User.isAdmin. Curatore/autore non sono globali, sempre relativi a un museo.
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
