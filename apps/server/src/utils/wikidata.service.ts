import axios from 'axios';
import { WikidataEntity } from '@artaround/shared';

const wikidataAxios = axios.create({
  headers: {
    'User-Agent': 'ArtAround/1.0 (https://artaround.app; contact@artaround.app)',
  },
});

const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

export class WikidataService {
  private static normalizeText(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private static escapeSparqlLiteral(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private static toCommonsThumbUrl(rawImageUrl?: string): string | undefined {
    if (!rawImageUrl) return undefined;

    const encodedFilename = rawImageUrl.replace(
      'http://commons.wikimedia.org/wiki/Special:FilePath/',
      '',
    );
    const filename = decodeURIComponent(encodedFilename);
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=300`;
  }

  private static formatEpoch(inception?: string): string | undefined {
    if (!inception) return undefined;

    const date = new Date(inception);
    const year = date.getFullYear();
    if (year < 0) return `${Math.abs(year)} a.C.`;
    if (year < 100) return `${year} d.C.`;
    return `${year}`;
  }

  private static normalizeDimensionToCm(rawValue?: string): number | undefined {
    if (!rawValue) return undefined;
    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) return undefined;

    // WDQS quantity values for dimensions are commonly in meters: convert to cm when plausible
    if (Math.abs(parsed) > 0 && Math.abs(parsed) <= 20) {
      return Math.round(parsed * 100);
    }

    return Math.round(parsed);
  }

  private static rankAndLimitMuseumResults(
    results: WikidataEntity[],
    query: string,
    limit: number,
  ) {
    const normalizedQuery = this.normalizeText(query);

    const scoreResult = (result: WikidataEntity): number => {
      const label = this.normalizeText(result.label || '');
      const description = this.normalizeText(result.description || '');
      const author = this.normalizeText(
        (result as WikidataEntity & { author?: string }).author || '',
      );

      if (label === normalizedQuery) return 120;
      if (label.startsWith(normalizedQuery)) return 100;
      if (label.includes(normalizedQuery)) return 85;
      if (author.startsWith(normalizedQuery)) return 70;
      if (author.includes(normalizedQuery)) return 60;
      if (description.includes(normalizedQuery)) return 45;
      return 10;
    };

    return results
      .map((result) => ({ result, score: scoreResult(result) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.result);
  }

  static async getEntity(wikidataId: string): Promise<WikidataEntity | null> {
    try {
      if (!/^Q\d+$/i.test(wikidataId)) return null;

      const sparqlQuery = `
        SELECT ?item ?itemLabel ?itemDescription
               (SAMPLE(?image) AS ?image)
               (SAMPLE(?creator) AS ?creator)
               (SAMPLE(?creatorLabelIt) AS ?creatorLabelIt)
               (SAMPLE(?creatorLabelEn) AS ?creatorLabelEn)
               (SAMPLE(?style) AS ?style)
               (SAMPLE(?styleLabelIt) AS ?styleLabelIt)
               (SAMPLE(?styleLabelEn) AS ?styleLabelEn)
               (SAMPLE(?period) AS ?period)
               (SAMPLE(?periodLabelIt) AS ?periodLabelIt)
               (SAMPLE(?periodLabelEn) AS ?periodLabelEn)
               (SAMPLE(?technique) AS ?technique)
               (SAMPLE(?techniqueLabelIt) AS ?techniqueLabelIt)
               (SAMPLE(?techniqueLabelEn) AS ?techniqueLabelEn)
               (GROUP_CONCAT(DISTINCT ?materialLabelPreferred; separator="|") AS ?materials)
               (SAMPLE(?location) AS ?location)
               (SAMPLE(?locationLabelIt) AS ?locationLabelIt)
               (SAMPLE(?locationLabelEn) AS ?locationLabelEn)
               (SAMPLE(?inception) AS ?inception)
               (SAMPLE(?height) AS ?height)
               (SAMPLE(?width) AS ?width)
               (SAMPLE(?depth) AS ?depth)
        WHERE {
          VALUES ?item { wd:${wikidataId} }

          OPTIONAL { ?item wdt:P18 ?image. }
          OPTIONAL {
            ?item wdt:P170 ?creator.
            OPTIONAL { ?creator rdfs:label ?creatorLabelIt. FILTER(LANG(?creatorLabelIt) = "it") }
            OPTIONAL { ?creator rdfs:label ?creatorLabelEn. FILTER(LANG(?creatorLabelEn) = "en") }
          }
          OPTIONAL {
            ?item wdt:P135 ?style.
            OPTIONAL { ?style rdfs:label ?styleLabelIt. FILTER(LANG(?styleLabelIt) = "it") }
            OPTIONAL { ?style rdfs:label ?styleLabelEn. FILTER(LANG(?styleLabelEn) = "en") }
          }
          OPTIONAL {
            ?item wdt:P2348 ?period.
            OPTIONAL { ?period rdfs:label ?periodLabelIt. FILTER(LANG(?periodLabelIt) = "it") }
            OPTIONAL { ?period rdfs:label ?periodLabelEn. FILTER(LANG(?periodLabelEn) = "en") }
          }
          OPTIONAL {
            { ?item wdt:P2079 ?technique. } UNION { ?item wdt:P366 ?technique. }
            OPTIONAL {
              ?technique rdfs:label ?techniqueLabelIt.
              FILTER(LANG(?techniqueLabelIt) = "it")
            }
            OPTIONAL {
              ?technique rdfs:label ?techniqueLabelEn.
              FILTER(LANG(?techniqueLabelEn) = "en")
            }
          }
          OPTIONAL {
            ?item wdt:P186 ?material.
            OPTIONAL { ?material rdfs:label ?materialLabelIt. FILTER(LANG(?materialLabelIt) = "it") }
            OPTIONAL { ?material rdfs:label ?materialLabelEn. FILTER(LANG(?materialLabelEn) = "en") }
            BIND(COALESCE(?materialLabelIt, ?materialLabelEn) AS ?materialLabelPreferred)
          }
          OPTIONAL {
            ?item wdt:P276 ?location.
            OPTIONAL {
              ?location rdfs:label ?locationLabelIt.
              FILTER(LANG(?locationLabelIt) = "it")
            }
            OPTIONAL {
              ?location rdfs:label ?locationLabelEn.
              FILTER(LANG(?locationLabelEn) = "en")
            }
          }
          OPTIONAL { ?item wdt:P571 ?inception. }
          OPTIONAL { ?item wdt:P2048 ?height. }
          OPTIONAL { ?item wdt:P2049 ?width. }
          OPTIONAL { ?item wdt:P2610 ?depth. }

          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        GROUP BY ?item ?itemLabel ?itemDescription
        LIMIT 1
      `;

      const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
        params: { query: sparqlQuery, format: 'json' },
      });

      const binding = response.data.results?.bindings?.[0];
      if (!binding?.item?.value) return null;

      return {
        id: wikidataId,
        label: binding.itemLabel?.value || wikidataId,
        description: binding.itemDescription?.value,
        imageUrl: this.toCommonsThumbUrl(binding.image?.value),
        author: binding.creatorLabelIt?.value || binding.creatorLabelEn?.value,
        authorId: binding.creator?.value?.split('/').pop(),
        movement: binding.styleLabelIt?.value || binding.styleLabelEn?.value,
        movementId: binding.style?.value?.split('/').pop(),
        style: binding.styleLabelIt?.value || binding.styleLabelEn?.value,
        styleId: binding.style?.value?.split('/').pop(),
        period: binding.periodLabelIt?.value || binding.periodLabelEn?.value,
        periodId: binding.period?.value?.split('/').pop(),
        technique: binding.techniqueLabelIt?.value || binding.techniqueLabelEn?.value,
        materials: binding.materials?.value
          ? binding.materials.value
              .split('|')
              .map((entry: string) => entry.trim())
              .filter(Boolean)
          : undefined,
        location: binding.locationLabelIt?.value || binding.locationLabelEn?.value,
        locationId: binding.location?.value?.split('/').pop(),
        inception: binding.inception?.value,
        year: this.formatEpoch(binding.inception?.value),
        epoch: this.formatEpoch(binding.inception?.value),
        room: binding.locationLabelIt?.value || binding.locationLabelEn?.value,
        dimensionHeight: this.normalizeDimensionToCm(binding.height?.value),
        dimensionWidth: this.normalizeDimensionToCm(binding.width?.value),
        dimensionDepth: this.normalizeDimensionToCm(binding.depth?.value),
        dimensionUnit: 'cm',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] getEntity SPARQL error:', message);
      return null;
    }
  }

  static async search(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      const normalizedQuery = this.escapeSparqlLiteral(query.trim());
      if (!normalizedQuery) return [];

      const mwapiLimit = Math.max(limit * 4, 40);

      interface SparqlBinding {
        item: { value: string };
        itemLabel?: { value: string };
        itemDescription?: { value: string };
        image?: { value: string };
        creator?: { value: string };
      }

      interface SearchResultLite {
        id: string;
        label: string;
        description: string;
        imageUrl?: string;
        hasCreator: boolean;
      }

      interface ScoredSearchResult extends SearchResultLite {
        score: number;
        artRelated: boolean;
      }

      const normalizedNeedle = normalizedQuery.toLowerCase();
      const artKeywords = [
        'dipinto',
        'quadro',
        'opera',
        "opera d'arte",
        'scultura',
        'affresco',
        'mosaico',
        'disegno',
        'ritratto',
        'statua',
        'painting',
        'artwork',
        'sculpture',
        'fresco',
        'mosaic',
        'drawing',
        'portrait',
      ];

      const fetchScoredResults = async (language: 'it' | 'en'): Promise<ScoredSearchResult[]> => {
        const sparqlQuery = `
          SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks ?image ?creator WHERE {
            SERVICE wikibase:mwapi {
              bd:serviceParam wikibase:endpoint "www.wikidata.org";
                              wikibase:api "EntitySearch";
                              mwapi:search "${normalizedQuery}";
                              mwapi:language "${language}";
                              mwapi:limit "${mwapiLimit}".
              ?item wikibase:apiOutputItem mwapi:item.
            }

            FILTER NOT EXISTS { ?item wdt:P31 wd:Q5. }

            OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
            OPTIONAL { ?item wdt:P18 ?image. }
            OPTIONAL { ?item wdt:P170 ?creator. }

            SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
          }
          ORDER BY DESC(?sitelinks)
          LIMIT ${Math.max(limit, 1)}
        `;

        const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
          params: {
            query: sparqlQuery,
            format: 'json',
          },
        });

        const bindings: SparqlBinding[] = response.data.results?.bindings || [];
        const rawResults: SearchResultLite[] = bindings.map((binding: SparqlBinding) => ({
          id: binding.item.value.split('/').pop() || '',
          label: binding.itemLabel?.value || '',
          description: binding.itemDescription?.value || '',
          imageUrl: this.toCommonsThumbUrl(binding.image?.value),
          hasCreator: Boolean(binding.creator?.value),
        }));

        return rawResults.map((result: SearchResultLite) => {
          const label = result.label.toLowerCase();
          const description = (result.description || '').toLowerCase();
          const text = `${label} ${description}`;

          let score = 0;
          if (label.startsWith(normalizedNeedle)) score += 40;
          if (text.includes(` ${normalizedNeedle} `)) score += 25;
          else if (text.includes(normalizedNeedle)) score += 10;

          const artRelated =
            result.hasCreator || artKeywords.some((keyword) => text.includes(keyword));
          if (artRelated) score += 80;

          return { ...result, score, artRelated };
        });
      };

      let scoredResults = await fetchScoredResults('it');
      let candidateResults = scoredResults.filter(
        (result: ScoredSearchResult) => result.artRelated,
      );

      if (candidateResults.length === 0) {
        scoredResults = await fetchScoredResults('en');
        candidateResults = scoredResults.filter((result: ScoredSearchResult) => result.artRelated);
      }

      return candidateResults
        .sort((a: ScoredSearchResult, b: ScoredSearchResult) => b.score - a.score)
        .slice(0, limit)
        .map(({ score: _score, artRelated: _artRelated, ...result }: ScoredSearchResult) => result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] artwork search SPARQL error:', message);
      return [];
    }
  }

  static async searchArtworksInMuseum(
    query: string,
    museumWikidataId: string,
    limit: number = 10,
  ): Promise<WikidataEntity[]> {
    try {
      if (!/^Q\d+$/i.test(museumWikidataId)) return [];

      const normalizedQuery = this.escapeSparqlLiteral(query.toLowerCase().trim());
      if (!normalizedQuery) return [];

      const queryLimit = Math.max(limit * 3, 30);
      const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks
               ?creator ?creatorLabel ?style ?styleLabel ?inception ?image WHERE {
          VALUES ?museum { wd:${museumWikidataId} }

          ?item (wdt:P276|wdt:P195) ?museum.
          ?item rdfs:label ?rawLabel.
          FILTER(LANG(?rawLabel) IN ("it", "en"))

          OPTIONAL {
            ?item schema:description ?rawDescription.
            FILTER(LANG(?rawDescription) IN ("it", "en"))
          }

          OPTIONAL {
            ?item wdt:P170 ?creator.
            ?creator rdfs:label ?rawCreatorLabel.
            FILTER(LANG(?rawCreatorLabel) IN ("it", "en"))
          }

          FILTER(
            CONTAINS(LCASE(STR(?rawLabel)), "${normalizedQuery}") ||
            (BOUND(?rawDescription) && CONTAINS(LCASE(STR(?rawDescription)), "${normalizedQuery}")) ||
            (BOUND(?rawCreatorLabel) && CONTAINS(LCASE(STR(?rawCreatorLabel)), "${normalizedQuery}"))
          )

          OPTIONAL { ?item wdt:P135 ?style. }
          OPTIONAL { ?item wdt:P571 ?inception. }
          OPTIONAL { ?item wdt:P18 ?image. }
          OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }

          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        ORDER BY DESC(?sitelinks)
        LIMIT ${queryLimit}
      `;

      const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      interface MuseumSparqlBinding {
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

      const bindings = response.data.results?.bindings || [];
      const mappedResults: WikidataEntity[] = bindings.map((binding: MuseumSparqlBinding) => ({
        id: binding.item.value.split('/').pop() || '',
        label: binding.itemLabel?.value || '',
        description: binding.itemDescription?.value || '',
        imageUrl: this.toCommonsThumbUrl(binding.image?.value),
        author: binding.creatorLabel?.value,
        authorId: binding.creator?.value.split('/').pop(),
        style: binding.styleLabel?.value,
        styleId: binding.style?.value.split('/').pop(),
        epoch: this.formatEpoch(binding.inception?.value),
      }));

      const dedupedById = Array.from(
        new Map<string, WikidataEntity>(
          mappedResults.map((result: WikidataEntity) => [result.id, result]),
        ).values(),
      );

      return this.rankAndLimitMuseumResults(dedupedById, query, limit);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] museum artwork search SPARQL error:', message);
      return [];
    }
  }

  static async searchMuseums(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      const normalizedQuery = this.escapeSparqlLiteral(query.toLowerCase().trim());
      if (!normalizedQuery) return [];

      const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks ?image WHERE {
          ?item wdt:P31 ?type.
          {
            ?type wdt:P279* wd:Q33506.
          } UNION {
            VALUES ?type {
              wd:Q33506 wd:Q207694 wd:Q1007870 wd:Q2087181 wd:Q1970365
              wd:Q3329412 wd:Q16735822 wd:Q588140 wd:Q18674739
            }
          }

          ?item rdfs:label ?rawLabel.
          FILTER(LANG(?rawLabel) IN ("it", "en"))

          OPTIONAL {
            ?item schema:description ?rawDescription.
            FILTER(LANG(?rawDescription) IN ("it", "en"))
          }

          FILTER(
            CONTAINS(LCASE(STR(?rawLabel)), "${normalizedQuery}") ||
            (BOUND(?rawDescription) && CONTAINS(LCASE(STR(?rawDescription)), "${normalizedQuery}"))
          )

          OPTIONAL { ?item wdt:P18 ?image. }
          OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        ORDER BY DESC(?sitelinks)
        LIMIT ${Math.max(limit, 1)}
      `;

      const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      interface SparqlBinding {
        item: { value: string };
        itemLabel?: { value: string };
        itemDescription?: { value: string };
        image?: { value: string };
      }

      const bindings = response.data.results?.bindings || [];
      return bindings.map((binding: SparqlBinding) => ({
        id: binding.item.value.split('/').pop() || '',
        label: binding.itemLabel?.value || '',
        description: binding.itemDescription?.value || '',
        imageUrl: this.toCommonsThumbUrl(binding.image?.value),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] museum search SPARQL error:', message);
      return [];
    }
  }

  static async searchAuthors(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      const normalizedQuery = this.escapeSparqlLiteral(query.toLowerCase().trim());
      if (!normalizedQuery) return [];

      const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks ?image WHERE {
          ?item wdt:P31 wd:Q5.
          ?item wdt:P106 ?occupation.
          VALUES ?occupation {
            wd:Q3391743
            wd:Q483501
            wd:Q1028181
            wd:Q1281618
            wd:Q10800557
            wd:Q1930187
          }

          ?item rdfs:label ?rawLabel.
          FILTER(LANG(?rawLabel) IN ("it", "en"))

          OPTIONAL {
            ?item schema:description ?rawDescription.
            FILTER(LANG(?rawDescription) IN ("it", "en"))
          }

          FILTER(
            CONTAINS(LCASE(STR(?rawLabel)), "${normalizedQuery}") ||
            (BOUND(?rawDescription) && CONTAINS(LCASE(STR(?rawDescription)), "${normalizedQuery}"))
          )

          OPTIONAL { ?item wdt:P18 ?image. }
          OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        ORDER BY DESC(?sitelinks)
        LIMIT ${Math.max(limit, 1)}
      `;

      const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      interface AuthorBinding {
        item: { value: string };
        itemLabel?: { value: string };
        itemDescription?: { value: string };
        image?: { value: string };
      }

      const bindings = response.data.results?.bindings || [];
      return bindings.map((binding: AuthorBinding) => ({
        id: binding.item.value.split('/').pop() || '',
        label: binding.itemLabel?.value || '',
        description: binding.itemDescription?.value || '',
        imageUrl: this.toCommonsThumbUrl(binding.image?.value),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] author search SPARQL error:', message);
      return [];
    }
  }

  static async searchMovements(query: string, limit: number = 10): Promise<WikidataEntity[]> {
    try {
      const normalizedQuery = this.escapeSparqlLiteral(query.toLowerCase().trim());
      if (!normalizedQuery) return [];

      const sparqlQuery = `
        SELECT DISTINCT ?item ?itemLabel ?itemDescription ?sitelinks ?image WHERE {
          ?item wdt:P31 ?type.
          VALUES ?type {
            wd:Q968159
            wd:Q1803238
            wd:Q1792644
            wd:Q2041552
          }

          ?item rdfs:label ?rawLabel.
          FILTER(LANG(?rawLabel) IN ("it", "en"))

          OPTIONAL {
            ?item schema:description ?rawDescription.
            FILTER(LANG(?rawDescription) IN ("it", "en"))
          }

          FILTER(
            CONTAINS(LCASE(STR(?rawLabel)), "${normalizedQuery}") ||
            (BOUND(?rawDescription) && CONTAINS(LCASE(STR(?rawDescription)), "${normalizedQuery}"))
          )

          OPTIONAL { ?item wdt:P18 ?image. }
          OPTIONAL { ?item wikibase:sitelinks ?sitelinks. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
        }
        ORDER BY DESC(?sitelinks)
        LIMIT ${Math.max(limit, 1)}
      `;

      const response = await wikidataAxios.get(WIKIDATA_SPARQL_URL, {
        params: {
          query: sparqlQuery,
          format: 'json',
        },
      });

      interface MovementBinding {
        item: { value: string };
        itemLabel?: { value: string };
        itemDescription?: { value: string };
        image?: { value: string };
      }

      const bindings = response.data.results?.bindings || [];
      return bindings.map((binding: MovementBinding) => ({
        id: binding.item.value.split('/').pop() || '',
        label: binding.itemLabel?.value || '',
        description: binding.itemDescription?.value || '',
        imageUrl: this.toCommonsThumbUrl(binding.image?.value),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Wikidata] movement search SPARQL error:', message);
      return [];
    }
  }
}
