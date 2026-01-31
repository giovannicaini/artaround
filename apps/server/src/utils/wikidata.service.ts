import axios from 'axios';
import { config } from '../config/config';
import { WikidataEntity } from '@artaround/shared';

// Wikidata requires a User-Agent header
const wikidataAxios = axios.create({
  headers: {
    'User-Agent': 'ArtAround/1.0 (https://artaround.app; contact@artaround.app)',
  },
});

// Wikidata Query Service endpoint for SPARQL
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

// Q116474095 = "tipo di opera d'arte" (artwork type)
const ARTWORK_TYPE_ID = 'Q116474095';

export class WikidataService {
  private static baseUrl = config.wikidata.apiUrl;

  // Get entity by Wikidata ID (Q number)
  static async getEntity(wikidataId: string): Promise<WikidataEntity | null> {
    try {
      const response = await wikidataAxios.get(this.baseUrl, {
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

  // Search entities - filtered to only artwork types (instances of Q116474095 subclasses)
  static async search(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      console.log(`[Wikidata] Searching artworks for: "${query}" (limit: ${limit})`);
      
      // SPARQL query to find artworks matching the search term
      // Looks for items that are instances of any subclass of "artwork type" (Q116474095)
      // or instances of common artwork classes like painting, sculpture, etc.
      const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription WHERE {
          SERVICE wikibase:mwapi {
            bd:serviceParam wikibase:endpoint "www.wikidata.org";
                            wikibase:api "EntitySearch";
                            mwapi:search "${query.replace(/"/g, '\\"')}";
                            mwapi:language "it";
                            mwapi:limit "${limit * 3}".
            ?item wikibase:apiOutputItem mwapi:item.
          }
          
          # Filter: must be instance of artwork-related classes
          ?item wdt:P31 ?type.
          {
            # Instance of artwork type or its subclasses
            ?type wdt:P279* wd:${ARTWORK_TYPE_ID}.
          } UNION {
            # Common artwork types: painting (Q3305213), sculpture (Q860861), drawing (Q93184)
            VALUES ?type { wd:Q3305213 wd:Q860861 wd:Q93184 wd:Q18573970 wd:Q4502142 wd:Q219423 wd:Q17489160 }
          }
          
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        LIMIT ${limit}
      `;
      
      const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      const bindings = response.data.results?.bindings || [];
      console.log(`[Wikidata] SPARQL results count: ${bindings.length}`);

      return bindings.map((binding: any) => ({
        id: binding.item.value.split('/').pop(), // Extract Q number from URI
        label: binding.itemLabel?.value || '',
        description: binding.itemDescription?.value || '',
      }));
    } catch (error: any) {
      console.error('[Wikidata] SPARQL search error:', error.message);
      
      // Fallback to simple search if SPARQL fails
      console.log('[Wikidata] Falling back to simple search...');
      return this.simpleSearch(query, limit);
    }
  }

  // Simple search without artwork filter (fallback)
  private static async simpleSearch(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      const response = await wikidataAxios.get(this.baseUrl, {
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
    } catch (error: any) {
      console.error('[Wikidata] Simple search error:', error.message);
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
