/*
 * File: /src/services/router.service.ts                                                 *
 * Project: @artaround/marketplace                                                       *
 * Last Modified: 14/09/2026                                                             *
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

// Router Service

export interface RouteState {
  route: string;
  params: Record<string, string>;
  title: string;
  seq: number;
}

type ParamsRecord = Record<string, string>;

interface RouteAdapter {
  // Segmenti di path DOPO il nome route (es. per "/artworks/abc/edit" con
  // route "artworks", ritorna ["abc", "edit"]). Array vuoto = nessun suffisso.
  toSegments(params: ParamsRecord): string[];
  // Inverso: dai segmenti di path (già senza il nome route) ricostruisce i params.
  fromSegments(segments: string[]): ParamsRecord;
}

const BASE_PATH = '/marketplace';

// Rimuove chiavi vuote/undefined (altrimenti finirebbero nell'URL come
// "undefined") e il viewMode 'list' implicito, per non duplicare la history.
function cleanParams(params: Record<string, string | undefined>): ParamsRecord {
  const result: ParamsRecord = {};
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    if (key === 'viewMode' && value === 'list') continue;
    result[key] = value;
  }
  return result;
}

// Adattatore per le pagine con lo schema "lista di entità, ognuna apribile in vista/modifica": artworks, contents, users.
function entityViewEditAdapter(idKey: string): RouteAdapter {
  return {
    toSegments(params) {
      const id = params[idKey];
      if (params.viewMode === 'create') return ['new'];
      if (id && params.viewMode === 'edit') return [id, 'edit'];
      if (id) return [id];
      return [];
    },
    fromSegments(segments) {
      if (segments[0] === 'new') return { viewMode: 'create' };
      if (segments[0]) {
        return { [idKey]: segments[0], viewMode: segments[1] === 'edit' ? 'edit' : 'view' };
      }
      return { viewMode: 'list' };
    },
  };
}

const routeAdapters: Record<string, RouteAdapter> = {
  artworks: entityViewEditAdapter('artworkId'),
  contents: entityViewEditAdapter('itemId'),
  users: entityViewEditAdapter('userId'),

  // Visite: niente ViewMode 'view' (si apre solo in modifica), più il tab
  // attivo dell'editor multi-sezione come ultimo segmento opzionale.
  visits: {
    toSegments(params) {
      if (params.viewMode === 'create') return ['new'];
      if (params.visitId && params.viewMode === 'edit') {
        return params.tab ? [params.visitId, 'edit', params.tab] : [params.visitId, 'edit'];
      }
      return [];
    },
    fromSegments(segments) {
      if (segments[0] === 'new') return { viewMode: 'create' };
      if (segments[0] && segments[1] === 'edit') {
        const result: ParamsRecord = { visitId: segments[0], viewMode: 'edit' };
        if (segments[2]) result.tab = segments[2];
        return result;
      }
      return { viewMode: 'list' };
    },
  },

  // Gestione musei: come le entità sopra, ma "curators" al posto di "view"
  // (non esiste una vista di sola lettura per un museo).
  'museums-management': {
    toSegments(params) {
      if (params.viewMode === 'create') return ['new'];
      if (params.museumId && params.viewMode === 'curators') return [params.museumId, 'curators'];
      if (params.museumId) return [params.museumId];
      return [];
    },
    fromSegments(segments) {
      if (segments[0] === 'new') return { viewMode: 'create' };
      if (segments[0]) {
        const result: ParamsRecord = { museumId: segments[0], viewMode: 'edit' };
        if (segments[1] === 'curators') result.viewMode = 'curators';
        return result;
      }
      return { viewMode: 'list' };
    },
  },

  // Mappa museo: solo museo/piano/marker selezionati, ognuno opzionale ma richiede il precedente.
  'museum-maps': {
    toSegments(params) {
      if (!params.museumId) return [];
      const segments = [params.museumId];
      if (params.floorId) {
        segments.push(params.floorId);
        if (params.markerId) segments.push(params.markerId);
      }
      return segments;
    },
    fromSegments(segments) {
      const result: ParamsRecord = {};
      if (segments[0]) result.museumId = segments[0];
      if (segments[1]) result.floorId = segments[1];
      if (segments[2]) result.markerId = segments[2];
      return result;
    },
  },
};

function buildUrl(route: string, params: ParamsRecord): string {
  const segments = routeAdapters[route]?.toSegments(params) ?? [];
  const suffix = segments.length > 0 ? `/${segments.join('/')}` : '';
  return `${BASE_PATH}/${route}${suffix}`;
}

function parseLocation(): { route: string; params: ParamsRecord } {
  const prefixPattern = new RegExp(`^${BASE_PATH}/?`);
  const path = window.location.pathname.replace(prefixPattern, '');
  const segments = path.split('/').filter(Boolean);
  const route = segments[0] || 'dashboard';
  const params = routeAdapters[route]?.fromSegments(segments.slice(1)) ?? {};
  return { route, params };
}

function paramsEqual(a: ParamsRecord, b: ParamsRecord): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => a[key] === b[key]);
}

/**
 * Router basato sulla history del browser, con adattatori per route/parametri di ogni pagina.
 */
class RouterService {
  // seq cresce ad ogni pushState, usato solo per sapere se "avanti" ha senso —
  // non persiste da solo, dopo un refresh a metà stack riparte da qui.
  private currentSeq = 0;
  private maxSeqSeen = 0;
  private initialized = false;

  private handlePopState = (event: PopStateEvent) => {
    const state = event.state as RouteState | null;
    if (state && typeof state.seq === 'number') {
      this.currentSeq = state.seq;
      this.notify(state);
      return;
    }

    // Nessuno stato (navigazione manuale nella barra indirizzi) — si riparte dal parsing dell'URL.
    const { route, params } = parseLocation();
    this.currentSeq = 0;
    this.notify({ route, params, title: '', seq: 0 });
  };

  // Da chiamare una volta sola all'avvio: ricava lo stato iniziale (history.state se presente, altrimenti dall'URL) e ascolta i bottoni del browser.
  init(): RouteState {
    if (this.initialized) return this.getCurrentState();
    this.initialized = true;

    const existing = window.history.state as RouteState | null;
    let state: RouteState;

    if (existing && typeof existing.seq === 'number') {
      state = existing;
      this.currentSeq = existing.seq;
      this.maxSeqSeen = existing.seq;
    } else {
      const { route, params } = parseLocation();
      state = { route, params, title: '', seq: 0 };
      window.history.replaceState(state, '', buildUrl(route, params));
    }

    window.addEventListener('popstate', this.handlePopState);
    return state;
  }

  // `replace: true` aggiorna la voce di history corrente invece di aggiungerne una nuova — solo per redirect di permesso, mai per una navigazione scelta dall'utente.
  navigate(
    route: string,
    params: Record<string, string | undefined> = {},
    options: { replace?: boolean; title?: string } = {},
  ): void {
    const cleanedParams = cleanParams(params);
    const title = options.title ?? '';

    // Una pagina può richiamare navigate() con lo stesso route+params appena applicato: senza
    // questo controllo diventerebbe un passo di history duplicato.
    if (!options.replace) {
      const current = this.getCurrentState();
      if (route === current.route && paramsEqual(cleanedParams, current.params)) {
        return;
      }
    }

    if (options.replace) {
      const state: RouteState = { route, params: cleanedParams, title, seq: this.currentSeq };
      window.history.replaceState(state, '', buildUrl(route, cleanedParams));
    } else {
      this.currentSeq += 1;
      this.maxSeqSeen = this.currentSeq;
      const state: RouteState = { route, params: cleanedParams, title, seq: this.currentSeq };
      window.history.pushState(state, '', buildUrl(route, cleanedParams));
    }

    this.notify(this.getCurrentState());
  }

  // Da chiamare a un login fresco: azzera il contatore avanti/indietro e sostituisce la voce corrente con la dashboard.
  reset(): void {
    this.currentSeq = 0;
    this.maxSeqSeen = 0;
    const state: RouteState = { route: 'dashboard', params: {}, title: '', seq: 0 };
    window.history.replaceState(state, '', buildUrl('dashboard', {}));
  }

  getCurrentState(): RouteState {
    const state = window.history.state as RouteState | null;
    if (state && typeof state.seq === 'number') return state;
    const { route, params } = parseLocation();
    return { route, params, title: '', seq: 0 };
  }

  canGoBack(): boolean {
    return this.currentSeq > 0;
  }

  canGoForward(): boolean {
    return this.currentSeq < this.maxSeqSeen;
  }

  private notify(state: RouteState): void {
    window.dispatchEvent(
      new CustomEvent('route-changed', {
        detail: {
          state,
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward(),
        },
      }),
    );
  }
}

export const routerService = new RouterService();
