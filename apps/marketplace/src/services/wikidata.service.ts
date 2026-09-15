/*
 * File: /src/services/wikidata.service.ts                                               *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 10/02/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import { apiService } from './api.service';
import type { WikidataEntity, WikidataSearchResult } from '@artaround/shared';

/**
 * Ricerca di opere, autori, movimenti e musei su Wikidata.
 */
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
