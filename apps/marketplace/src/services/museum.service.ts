import { apiService, getErrorMessage } from './api.service';
import type {
  Museum,
  MuseumFloor,
  MapMarker,
  FloorConnection,
  CreateMuseumData,
  MuseumCurator,
  MuseumConfigResponse,
} from '@artaround/shared';

type MuseumLanguageSyncResult = {
  museumId: string;
  activeLanguages: string[];
  items: {
    scanned: number;
    updated: number;
    generated: number;
    removed: number;
    failed: number;
  };
  visits: {
    scanned: number;
    updated: number;
    generated: number;
    removed: number;
    failed: number;
  };
};

export class MuseumService {
  async getMuseums(): Promise<Museum[]> {
    const response = await apiService.get<Museum[]>('/museums');

    if (response.success && response.data) {
      return response.data;
    }

    return [];
  }

  async getMuseum(id: string): Promise<Museum | null> {
    const response = await apiService.get<Museum>(`/museums/${id}`);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  async getMuseumConfig(id: string): Promise<MuseumConfigResponse | null> {
    const response = await apiService.get<MuseumConfigResponse>(`/museums/${id}/config`);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  async createMuseum(data: CreateMuseumData): Promise<{ data: Museum | null; error?: string }> {
    const response = await apiService.post<Museum>('/museums', data);
    if (response.success && response.data) {
      return { data: response.data };
    }
    return {
      data: null,
      error: getErrorMessage(response, 'Errore durante la creazione del museo'),
    };
  }

  async updateMuseum(
    id: string,
    data: Partial<CreateMuseumData>,
  ): Promise<{ data: Museum | null; error?: string }> {
    const response = await apiService.put<Museum>(`/museums/${id}`, data);
    if (response.success && response.data) {
      return { data: response.data };
    }
    return {
      data: null,
      error: getErrorMessage(response, 'Errore durante aggiornamento del museo'),
    };
  }

  async syncMuseumLanguages(
    id: string,
    activeLanguages: string[],
  ): Promise<{ data: MuseumLanguageSyncResult | null; error?: string }> {
    const response = await apiService.post<MuseumLanguageSyncResult>(
      `/museums/${id}/sync-languages`,
      {
        activeLanguages,
      },
    );

    if (response.success && response.data) {
      return { data: response.data };
    }

    return {
      data: null,
      error: getErrorMessage(response, 'Errore durante sincronizzazione lingue museo'),
    };
  }

  async deleteMuseum(id: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(`/museums/${id}`);
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante eliminazione del museo'),
    };
  }

  async getCurators(museumId: string): Promise<MuseumCurator[]> {
    const response = await apiService.get<MuseumCurator[]>(`/museums/${museumId}/curators`);
    return response.success && response.data ? response.data : [];
  }

  async addCurator(
    museumId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post(`/museums/${museumId}/curators`, { userId });
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante assegnazione curatore'),
    };
  }

  async removeCurator(
    museumId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(`/museums/${museumId}/curators/${userId}`);
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante rimozione curatore'),
    };
  }

  async getFloors(museumId: string): Promise<MuseumFloor[]> {
    const response = await apiService.get<MuseumFloor[]>(`/museums/${museumId}/floors`);
    return response.success && response.data ? response.data : [];
  }

  async getFloor(museumId: string, floorId: string): Promise<MuseumFloor | null> {
    const response = await apiService.get<MuseumFloor>(`/museums/${museumId}/floors/${floorId}`);
    return response.success && response.data ? response.data : null;
  }

  async addFloor(
    museumId: string,
    floor: Omit<MuseumFloor, 'markers' | 'connections'>,
  ): Promise<{ data: MuseumFloor | null; error?: string }> {
    const response = await apiService.post<MuseumFloor>(`/museums/${museumId}/floors`, floor);
    if (response.success && response.data) {
      return { data: response.data };
    }
    return { data: null, error: getErrorMessage(response, 'Errore sconosciuto') };
  }

  async updateFloor(
    museumId: string,
    floorId: string,
    data: Partial<MuseumFloor>,
  ): Promise<MuseumFloor | null> {
    const response = await apiService.put<MuseumFloor>(
      `/museums/${museumId}/floors/${floorId}`,
      data,
    );
    return response.success && response.data ? response.data : null;
  }

  async deleteFloor(museumId: string, floorId: string): Promise<boolean> {
    const response = await apiService.delete(`/museums/${museumId}/floors/${floorId}`);
    return response.success;
  }

  async getMarkers(museumId: string, floorId: string): Promise<MapMarker[]> {
    const response = await apiService.get<MapMarker[]>(
      `/museums/${museumId}/floors/${floorId}/markers`,
    );
    return response.success && response.data ? response.data : [];
  }

  async addMarker(
    museumId: string,
    floorId: string,
    marker: Omit<MapMarker, 'floorId' | 'isVisible'>,
  ): Promise<MapMarker | null> {
    const response = await apiService.post<MapMarker>(
      `/museums/${museumId}/floors/${floorId}/markers`,
      marker,
    );
    return response.success && response.data ? response.data : null;
  }

  async updateMarker(
    museumId: string,
    floorId: string,
    markerId: string,
    data: Partial<MapMarker>,
  ): Promise<MapMarker | null> {
    const response = await apiService.put<MapMarker>(
      `/museums/${museumId}/floors/${floorId}/markers/${markerId}`,
      data,
    );
    return response.success && response.data ? response.data : null;
  }

  async updateMarkers(
    museumId: string,
    floorId: string,
    markers: MapMarker[],
  ): Promise<MapMarker[]> {
    const response = await apiService.put<MapMarker[]>(
      `/museums/${museumId}/floors/${floorId}/markers`,
      { markers },
    );
    return response.success && response.data ? response.data : [];
  }

  async deleteMarker(museumId: string, floorId: string, markerId: string): Promise<boolean> {
    const response = await apiService.delete(
      `/museums/${museumId}/floors/${floorId}/markers/${markerId}`,
    );
    return response.success;
  }

  async addConnection(
    museumId: string,
    floorId: string,
    connection: FloorConnection,
  ): Promise<FloorConnection | null> {
    const response = await apiService.post<FloorConnection>(
      `/museums/${museumId}/floors/${floorId}/connections`,
      connection,
    );
    return response.success && response.data ? response.data : null;
  }

  async deleteConnection(
    museumId: string,
    floorId: string,
    connectionId: string,
  ): Promise<boolean> {
    const response = await apiService.delete(
      `/museums/${museumId}/floors/${floorId}/connections/${connectionId}`,
    );
    return response.success;
  }
}

export const museumService = new MuseumService();
