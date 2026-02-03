import { apiService } from './api.service';
import type { Museum, MuseumFloor, MapMarker, FloorConnection } from '@artaround/shared';

export interface MuseumConfig {
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
  features?: {
    audioGuide?: boolean;
    virtualTour?: boolean;
  };
  settings?: Record<string, unknown>;
}

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

  async getMuseumConfig(id: string): Promise<MuseumConfig | null> {
    const response = await apiService.get<MuseumConfig>(`/museums/${id}/config`);

    if (response.success && response.data) {
      return response.data;
    }

    return null;
  }

  // ========================================
  // FLOOR MANAGEMENT
  // ========================================

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
    return { data: null, error: response.error?.message || 'Errore sconosciuto' };
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

  // ========================================
  // MARKER MANAGEMENT
  // ========================================

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

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================

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
