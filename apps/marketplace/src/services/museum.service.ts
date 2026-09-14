import { apiService, getErrorMessage } from './api.service';
import type {
  Museum,
  MuseumFloor,
  MapMarker,
  FloorConnection,
  MuseumRoom,
  CreateMuseumData,
  MuseumCurator,
  MuseumRole,
  MuseumRoleRequest,
  MuseumRoleRequestWithNames,
} from '@artaround/shared';

type MuseumJobStarted = {
  jobId: string;
  museumId: string;
  activeLanguages: string[];
};

type GeocodeResult = {
  lat: number;
  lng: number;
  displayName?: string;
  provider?: string;
  placeId?: number;
};

/**
 * CRUD di musei, piani, marker, sale e delle relative azioni AI in background.
 */
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

  // Aggiorna subito le lingue attive, poi avvia in background la rigenerazione
  // delle traduzioni mancanti — risponde subito col jobId, non aspetta la fine.
  async syncMuseumLanguages(
    id: string,
    activeLanguages: string[],
  ): Promise<{ data: MuseumJobStarted | null; error?: string }> {
    const response = await apiService.post<MuseumJobStarted>(`/museums/${id}/sync-languages`, {
      activeLanguages,
    });

    if (response.success && response.data) {
      return { data: response.data };
    }

    return {
      data: null,
      error: getErrorMessage(response, 'Errore durante sincronizzazione lingue museo'),
    };
  }

  // Avvia in background la generazione con OpenAI dell'audio mancante del museo —
  // azione esplicita, separata da syncMuseumLanguages per costo/tempo.
  async generateMuseumAudio(
    id: string,
  ): Promise<{ data: MuseumJobStarted | null; error?: string }> {
    const response = await apiService.post<MuseumJobStarted>(`/museums/${id}/generate-audio`, {});

    if (response.success && response.data) {
      return { data: response.data };
    }

    return {
      data: null,
      error: getErrorMessage(response, "Errore durante la generazione dell'audio"),
    };
  }

  async geocodeMuseumLocation(params: {
    address: string;
    city: string;
    postalCode?: string;
    nation?: string;
  }): Promise<{ data: GeocodeResult | null; error?: string }> {
    const query = new URLSearchParams();
    query.set('address', params.address);
    query.set('city', params.city);

    if (params.postalCode?.trim()) {
      query.set('postalCode', params.postalCode.trim());
    }

    if (params.nation?.trim()) {
      query.set('nation', params.nation.trim());
    }

    const response = await apiService.get<GeocodeResult>(`/utils/geocode?${query.toString()}`);

    if (response.success) {
      return { data: response.data || null };
    }

    return {
      data: null,
      error: getErrorMessage(response, 'Errore durante geocodifica indirizzo'),
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

  // ─── Autori del museo (assegnabili anche dal curatore del museo, non solo dall'admin) ───
  async addAuthor(museumId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post(`/museums/${museumId}/authors`, { userId });
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante assegnazione autore'),
    };
  }

  async removeAuthor(
    museumId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(`/museums/${museumId}/authors/${userId}`);
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante rimozione autore'),
    };
  }

  // ─── Richieste di ruolo (un utente chiede di diventare curatore/autore di un museo) ───
  async requestRole(
    museumId: string,
    role: MuseumRole,
  ): Promise<{ data: MuseumRoleRequest | null; error?: string }> {
    const response = await apiService.post<MuseumRoleRequest>(
      `/museums/${museumId}/role-requests`,
      { role },
    );
    if (response.success && response.data) {
      return { data: response.data };
    }
    return { data: null, error: getErrorMessage(response, 'Errore durante la richiesta') };
  }

  async cancelRoleRequest(
    museumId: string,
    requestId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.delete(`/museums/${museumId}/role-requests/${requestId}`);
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, 'Errore durante la rimozione della richiesta'),
    };
  }

  async approveRoleRequest(
    museumId: string,
    requestId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const response = await apiService.post(
      `/museums/${museumId}/role-requests/${requestId}/approve`,
      {},
    );
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: getErrorMessage(response, "Errore durante l'approvazione della richiesta"),
    };
  }

  // Richieste che l'utente corrente può revisionare: tutte se admin, solo
  // quelle dei musei che cura altrimenti (vedi MuseumController.listReviewableRoleRequests)
  async getReviewableRoleRequests(): Promise<MuseumRoleRequestWithNames[]> {
    const response = await apiService.get<MuseumRoleRequestWithNames[]>('/museums/role-requests');
    return response.success && response.data ? response.data : [];
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

  // ─── Sale (gestione parallela ai marker) ─────────────────
  async getRooms(museumId: string): Promise<MuseumRoom[]> {
    const response = await apiService.get<MuseumRoom[]>(`/museums/${museumId}/rooms`);
    return response.success && response.data ? response.data : [];
  }

  async createRoom(
    museumId: string,
    room: { id: string; title: string; subtitle?: string },
  ): Promise<{ data: MuseumRoom | null; error?: string }> {
    const response = await apiService.post<MuseumRoom>(`/museums/${museumId}/rooms`, room);
    if (response.success && response.data) {
      return { data: response.data };
    }
    return { data: null, error: getErrorMessage(response, 'Errore sconosciuto') };
  }

  async renameRoom(
    museumId: string,
    roomId: string,
    title: string,
    subtitle?: string,
  ): Promise<{ data: MuseumRoom | null; error?: string }> {
    const response = await apiService.put<MuseumRoom>(`/museums/${museumId}/rooms/${roomId}`, {
      title,
      subtitle,
    });
    if (response.success && response.data) {
      return { data: response.data };
    }
    return { data: null, error: getErrorMessage(response, 'Errore sconosciuto') };
  }

  async outlineRoom(
    museumId: string,
    roomId: string,
    floorId: string,
    polygon: Array<{ x: number; y: number }>,
  ): Promise<{ data: MuseumRoom | null; error?: string }> {
    const response = await apiService.put<MuseumRoom>(
      `/museums/${museumId}/rooms/${roomId}/outline`,
      { floorId, polygon },
    );
    if (response.success && response.data) {
      return { data: response.data };
    }
    return { data: null, error: getErrorMessage(response, 'Errore sconosciuto') };
  }

  async removeRoomOutline(museumId: string, roomId: string): Promise<boolean> {
    const response = await apiService.delete(`/museums/${museumId}/rooms/${roomId}/outline`);
    return response.success;
  }

  async deleteRoom(museumId: string, roomId: string): Promise<boolean> {
    const response = await apiService.delete(`/museums/${museumId}/rooms/${roomId}`);
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
