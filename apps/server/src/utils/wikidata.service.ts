import axios from 'axios';
import { config } from '../config/config';
import { WikidataEntity } from '@artaround/shared';

export class WikidataService {
  private static baseUrl = config.wikidata.apiUrl;

  // Get entity by Wikidata ID (Q number)
  static async getEntity(wikidataId: string): Promise<WikidataEntity | null> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          action: 'wbgetentities',
          ids: wikidataId,
          format: 'json',
          languages: 'it|en',
          props: 'labels|descriptions|claims',
        },
      });

      const entity = response.data.entities[wikidataId];
      if (!entity) return null;

      // Extract label and description
      const label = entity.labels?.it?.value || entity.labels?.en?.value || wikidataId;
      const description = entity.descriptions?.it?.value || entity.descriptions?.en?.value;

      // Extract image if available (P18)
      let imageUrl;
      if (entity.claims?.P18) {
        const imageClaim = entity.claims.P18[0];
        const filename = imageClaim.mainsnak.datavalue?.value;
        if (filename) {
          imageUrl = await this.getImageUrl(filename);
        }
      }

      return {
        id: wikidataId,
        label,
        description,
        imageUrl,
        properties: entity.claims,
      };
    } catch (error) {
      console.error('Wikidata API error:', error);
      return null;
    }
  }

  // Search entities
  static async search(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          action: 'wbsearchentities',
          search: query,
          format: 'json',
          language: 'it',
          limit,
        },
      });

      const results = response.data.search || [];
      return results.map((result: any) => ({
        id: result.id,
        label: result.label,
        description: result.description,
      }));
    } catch (error) {
      console.error('Wikidata search error:', error);
      return [];
    }
  }

  // Get Commons image URL from filename
  private static async getImageUrl(filename: string): Promise<string | undefined> {
    try {
      const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
        params: {
          action: 'query',
          titles: `File:${filename}`,
          prop: 'imageinfo',
          iiprop: 'url',
          format: 'json',
        },
      });

      const pages = response.data.query?.pages;
      if (pages) {
        const page = Object.values(pages)[0] as any;
        return page.imageinfo?.[0]?.url;
      }
    } catch (error) {
      console.error('Wikimedia Commons image error:', error);
    }
    return undefined;
  }
}
