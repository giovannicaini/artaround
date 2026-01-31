import { apiService } from './api.service';
import type { WikidataEntity } from '@artaround/shared';

export interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
}

export class WikidataService {
  async search(query: string, limit: number = 10): Promise<WikidataSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const response = await apiService.get<WikidataSearchResult[]>(
      `/utils/wikidata-search?q=${encodeURIComponent(query)}&limit=${limit}`
    );
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return [];
  }

  async getEntity(id: string): Promise<WikidataEntity | null> {
    if (!id) {
      return null;
    }

    const response = await apiService.get<WikidataEntity>(`/utils/wikidata/${id}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    return null;
  }
}

export const wikidataService = new WikidataService();
