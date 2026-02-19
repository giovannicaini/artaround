import { apiService } from './api.service';
import type { WikidataEntity, WikidataSearchResult } from '@artaround/shared';

export class WikidataService {
  async search(
    query: string,
    limit: number = 10,
    type: 'artwork' | 'museum' | 'author' | 'movement' = 'artwork',
    museumId?: string | null | undefined,
  ): Promise<WikidataSearchResult[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      type,
    });
    if (museumId && typeof museumId === 'string') params.append('museumId', museumId);

    const response = await apiService.get<WikidataSearchResult[]>(
      `/utils/wikidata-search?${params.toString()}`,
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
