import axios from 'axios';
import { config } from '../config/config.js';
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
      // Results are ordered by popularity (number of sitelinks)
      // Also extracts: creator (P170), style (P135), inception (P571), image (P18)
      const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks 
               ?creator ?creatorLabel ?style ?styleLabel ?inception ?image WHERE {
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
            # Common artwork types: 
            # Q3305213 = painting, Q860861 = sculpture, Q93184 = drawing
            # Q18573970 = mural, Q4502142 = visual artwork, Q219423 = statue
            # Q17489160 = triptych, Q22970505 = painted crucifix, Q132137 = icon
            # Q15711026 = altarpiece, Q4364339 = religious art, Q125191 = photograph
            VALUES ?type { 
              wd:Q3305213 wd:Q860861 wd:Q93184 wd:Q18573970 wd:Q4502142 
              wd:Q219423 wd:Q17489160 wd:Q22970505 wd:Q132137 wd:Q15711026 
              wd:Q4364339 wd:Q125191
            }
          }
          
          # Get sitelinks count for popularity ranking
          ?item wikibase:sitelinks ?sitelinks.
          
          # Optional: creator/artist (P170)
          OPTIONAL { ?item wdt:P170 ?creator. }
          
          # Optional: style/movement (P135)
          OPTIONAL { ?item wdt:P135 ?style. }
          
          # Optional: inception/date (P571)
          OPTIONAL { ?item wdt:P571 ?inception. }
          
          # Optional: image (P18)
          OPTIONAL { ?item wdt:P18 ?image. }
          
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        ORDER BY DESC(?sitelinks)
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

      interface SparqlBinding {
        item: { value: string };
        itemLabel?: { value: string };
        itemDescription?: { value: string };
        creator?: { value: string };
        creatorLabel?: { value: string };
        style?: { value: string };
        styleLabel?: { value: string };
        inception?: { value: string };
        image?: { value: string };
      }

      return bindings.map((binding: SparqlBinding) => {
        // Extract Q number from URI
        const id = binding.item.value.split('/').pop() || '';
        const creatorId = binding.creator?.value.split('/').pop();
        const styleId = binding.style?.value.split('/').pop();

        // Convert Commons filename to thumbnail URL
        let imageUrl: string | undefined;
        if (binding.image?.value) {
          // The filename comes already URL-encoded from SPARQL, so we decode first then re-encode properly
          const encodedFilename = binding.image.value.replace(
            'http://commons.wikimedia.org/wiki/Special:FilePath/',
            '',
          );
          const filename = decodeURIComponent(encodedFilename);
          imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`;
        }

        // Format epoch from date
        let epoch: string | undefined;
        if (binding.inception?.value) {
          const date = new Date(binding.inception.value);
          const year = date.getFullYear();
          if (year < 0) {
            epoch = `${Math.abs(year)} a.C.`;
          } else if (year < 100) {
            epoch = `${year} d.C.`;
          } else {
            epoch = `${year}`;
          }
        }

        return {
          id,
          label: binding.itemLabel?.value || '',
          description: binding.itemDescription?.value || '',
          imageUrl,
          author: binding.creatorLabel?.value,
          authorId: creatorId,
          style: binding.styleLabel?.value,
          styleId,
          epoch,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] SPARQL search error:', message);

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

      interface SearchResult {
        id: string;
        label: string;
        description?: string;
      }

      const results: SearchResult[] = response.data.search || [];
      return results.map((result) => ({
        id: result.id,
        label: result.label,
        description: result.description,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] Simple search error:', message);
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

      interface WikimediaPage {
        imageinfo?: Array<{ url?: string }>;
      }

      const pages = response.data.query?.pages;
      if (pages) {
        const page = Object.values(pages)[0] as WikimediaPage;
        return page.imageinfo?.[0]?.url;
      }
    } catch (error) {
      console.error('Wikimedia Commons image error:', error);
    }
    return undefined;
  }
}
