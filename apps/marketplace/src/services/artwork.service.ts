import { apiService, type PaginatedApiResponse, getErrorMessage } from './api.service';
import type {
  Artwork,
  ArtworkMapPosition,
  ArtworkFilters as SharedArtworkFilters,
  CreateArtworkData,
  UpdateArtworkData,
} from '@artaround/shared';

export type ArtworkFilters = SharedArtworkFilters & {
  author?: string;
  movement?: string;
};

export interface ArtworksResponse {
  artworks: Artwork[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ArtworkService {
  async getArtworks(filters: ArtworkFilters = {}): Promise<ArtworksResponse> {
    const params = new URLSearchParams();

    if (filters.museumId) params.append('museumId', filters.museumId);
    if (filters.author) params.append('author', filters.author);
    if (filters.authorWikidataId) params.append('authorWikidataId', filters.authorWikidataId);
    if (filters.artworkType) params.append('artworkType', filters.artworkType);
    if (filters.movement) params.append('movement', filters.movement);
    if (filters.movementWikidataId) params.append('movementWikidataId', filters.movementWikidataId);
    if (filters.room) params.append('room', filters.room);
    if (filters.floor) params.append('floor', filters.floor);
    if (filters.yearFrom) params.append('yearFrom', String(filters.yearFrom));
    if (filters.yearTo) params.append('yearTo', String(filters.yearTo));
    if (filters.search) params.append('search', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = `/artworks${queryString ? `?${queryString}` : ''}`;

    const response = (await apiService.get<Artwork[]>(url)) as PaginatedApiResponse<Artwork[]>;

    // Handle both response formats: { success, data } or { data, pagination }
    const data = response.data;
    if (data && Array.isArray(data) && response.pagination) {
      return {
        artworks: data,
        pagination: {
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
        },
      };
    }

    return { artworks: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } };
  }

  async getArtworksByMuseum(museumWikidataId: string): Promise<Artwork[]> {
    const url = `/artworks/museum/${museumWikidataId}`;
    const response = await apiService.get<Artwork[]>(url);

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  async getArtwork(id: string): Promise<Artwork | null> {
    const response = await apiService.get<Artwork>(`/artworks/${id}`);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  async getArtworkByWikidataId(wikidataId: string): Promise<Artwork | null> {
    const response = await apiService.get<Artwork>(`/artworks/wikidata/${wikidataId}`);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  async createArtwork(data: CreateArtworkData): Promise<Artwork | null> {
    const response = await apiService.post<Artwork>('/artworks', data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(getErrorMessage(response, 'Errore durante la creazione'));
  }

  async updateArtwork(id: string, data: UpdateArtworkData): Promise<Artwork | null> {
    const response = await apiService.put<Artwork>(`/artworks/${id}`, data);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(getErrorMessage(response, "Errore durante l'aggiornamento"));
  }

  async updateArtworkMapPosition(
    id: string,
    mapPosition: ArtworkMapPosition,
  ): Promise<Artwork | null> {
    const response = await apiService.put<Artwork>(`/artworks/${id}/map-position`, mapPosition);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(getErrorMessage(response, "Errore durante l'aggiornamento della posizione"));
  }

  async deleteArtwork(id: string): Promise<boolean> {
    const response = await apiService.delete<void>(`/artworks/${id}`);
    return response.success;
  }
}

export const artworkService = new ArtworkService();
