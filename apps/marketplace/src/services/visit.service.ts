import { apiService, type PaginatedApiResponse, getErrorMessage } from './api.service';
import type { Visit, VisitFilters, CreateVisitData, UpdateVisitData } from '@artaround/shared';

export interface VisitsResponse {
  visits: Visit[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class VisitService {
  async getVisits(filters: VisitFilters = {}): Promise<VisitsResponse> {
    const params = new URLSearchParams();

    if (filters.museumId) params.append('museumId', filters.museumId);
    if (filters.authorId) params.append('authorId', filters.authorId);
    if (filters.isPublished !== undefined)
      params.append('isPublished', String(filters.isPublished));
    if (filters.isFree !== undefined) params.append('isFree', String(filters.isFree));
    if (filters.languageLevel) params.append('languageLevel', filters.languageLevel);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const query = params.toString();
    const endpoint = `/visits${query ? `?${query}` : ''}`;

    const response = (await apiService.get<Visit[]>(endpoint)) as PaginatedApiResponse<Visit[]>;

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare le visite'));
    }

    return {
      visits: response.data,
      pagination: response.pagination || {
        page: 1,
        limit: 20,
        total: response.data.length,
        totalPages: 1,
      },
    };
  }

  async getMyVisits(): Promise<Visit[]> {
    const response = await apiService.get<Visit[]>('/visits/my-visits');

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare le tue visite'));
    }

    return response.data;
  }

  async getByMuseum(museumId: string, isPublished?: boolean): Promise<Visit[]> {
    const params = new URLSearchParams();
    if (isPublished !== undefined) params.append('isPublished', String(isPublished));

    const query = params.toString();
    const endpoint = `/visits/museum/${museumId}${query ? `?${query}` : ''}`;

    const response = await apiService.get<Visit[]>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile caricare le visite del museo'));
    }

    return response.data;
  }

  async getById(id: string): Promise<Visit> {
    const response = await apiService.get<Visit>(`/visits/${id}`);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Visita non trovata'));
    }

    return response.data;
  }

  async create(data: CreateVisitData): Promise<Visit> {
    const response = await apiService.post<Visit>('/visits', data);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile creare la visita'));
    }

    return response.data;
  }

  async update(id: string, data: UpdateVisitData): Promise<Visit> {
    const response = await apiService.put<Visit>(`/visits/${id}`, data);

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile aggiornare la visita'));
    }

    return response.data;
  }

  async delete(id: string): Promise<void> {
    const response = await apiService.delete(`/visits/${id}`);

    if (!response.success) {
      throw new Error(getErrorMessage(response, 'Impossibile eliminare la visita'));
    }
  }

  // POST, non PUT: le route sono POST /:id/publish e /:id/unpublish (vedi
  // visit.routes.ts) — un PUT qui non trova nessuna route e fallisce sempre.
  async publish(id: string): Promise<Visit> {
    const response = await apiService.post<Visit>(`/visits/${id}/publish`, {});

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile pubblicare la visita'));
    }

    return response.data;
  }

  async unpublish(id: string): Promise<Visit> {
    const response = await apiService.post<Visit>(`/visits/${id}/unpublish`, {});

    if (!response.success || !response.data) {
      throw new Error(getErrorMessage(response, 'Impossibile annullare la pubblicazione'));
    }

    return response.data;
  }

  // Avvia in background la generazione audio OpenAI limitata a questa
  // visita — equivalente di museumService.generateMuseumAudio ma scoped
  // (vedi VisitController.generateAudio). Risponde subito col jobId,
  // l'avanzamento si segue da jobsService (GET /api/jobs).
  async generateVisitAudio(id: string): Promise<{ jobId: string | null; error?: string }> {
    const response = await apiService.post<{ jobId: string }>(`/visits/${id}/generate-audio`, {});
    if (response.success && response.data) {
      return { jobId: response.data.jobId };
    }
    return {
      jobId: null,
      error: getErrorMessage(response, "Errore durante l'avvio della generazione audio"),
    };
  }

  // Avvia in background la sincronizzazione delle traduzioni limitata a
  // questa visita (lei stessa + gli item che referenzia), con le lingue
  // attive già impostate sul museo — equivalente di
  // museumService.syncMuseumLanguages ma scoped (vedi VisitController.syncLanguages).
  // Risponde subito col jobId, l'avanzamento si segue da jobsService (GET /api/jobs).
  async syncVisitLanguages(id: string): Promise<{ jobId: string | null; error?: string }> {
    const response = await apiService.post<{ jobId: string }>(`/visits/${id}/sync-languages`, {});
    if (response.success && response.data) {
      return { jobId: response.data.jobId };
    }
    return {
      jobId: null,
      error: getErrorMessage(response, "Errore durante l'avvio della sincronizzazione lingue"),
    };
  }
}

export const visitService = new VisitService();
