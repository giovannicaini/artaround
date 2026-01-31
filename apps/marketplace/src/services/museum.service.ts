import { apiService } from './api.service';
import type { Museum } from '@artaround/shared';

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

  async getMuseumConfig(id: string): Promise<any> {
    const response = await apiService.get<any>(`/museums/${id}/config`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return null;
  }
}

export const museumService = new MuseumService();
