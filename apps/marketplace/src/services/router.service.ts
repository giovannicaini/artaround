/**
 * Router Service
 *
 * Sostituisce il vecchio history.service.ts (stack in localStorage, nessuna
 * vera URL): qui la history reale del browser (`pushState`/`popstate`) è
 * l'unica fonte di verità, così avanti/indietro funzionano anche con i
 * bottoni nativi del browser, e ogni stato granulare (non solo le
 * macro-pagine) ha un vero passo di history — stesso approccio già usato da
 * apps/navigator con react-router. Il fallback SPA per i deep-link sotto
 * `/marketplace/*` esiste già lato server (apps/server/src/index.ts).
 *
 * Gli URL sono path "ad hoc" per ogni route (es. `/artworks/:id/edit`), non
 * query string generiche (`?id=...&view=edit`): più leggibili e più vicini
 * alle convenzioni REST già usate da apps/navigator. Ogni route con
 * parametri ha un adattatore dedicato in `routeAdapters` che sa tradurre
 * route+params ↔ segmenti di path; le route senza adattatore non hanno
 * parametri da mettere in URL.
 */

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

// Rimuove chiavi con valore vuoto/undefined prima di passarle a un adattatore
// — altrimenti finirebbero nell'URL come segmenti letterali "undefined".
// 'list' è il viewMode implicito quando assente (ogni pagina lo assume come
// fallback): non va trattato come un valore diverso da "nessun viewMode",
// altrimenti una navigazione con params vuoti (es. da un click di menu),
// seguita dalla pagina stessa che rispecchia il proprio 'list' di default,
// risulterebbe in due voci di history invece di una.
function cleanParams(params: Record<string, string | undefined>): ParamsRecord {
  const result: ParamsRecord = {};
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    if (key === 'viewMode' && value === 'list') continue;
    result[key] = value;
  }
  return result;
}

/**
 * Adattatore per le pagine con lo schema "lista di entità, ognuna apribile
 * in vista/modifica": artworks, contents, users. Tutte e tre condividono lo
 * stesso ViewMode ('list' | 'create' | 'edit' | 'view') e lo stesso schema
 * di URL: `/new` per la creazione, `/:id` per la vista, `/:id/edit` per la
 * modifica.
 */
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

  // Mappa museo: nessun ViewMode, solo museo/piano/marker selezionati —
  // ognuno opzionale ma richiede il precedente (non ha senso un marker senza
  // un piano).
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

class RouterService {
  // seq cresce a ogni pushState di questa sessione di tab; usato solo per
  // sapere se "avanti" ha senso (non c'è modo standard di chiederlo al
  // browser). Non persiste da solo: dopo un refresh a metà stack riparte da
  // qui, "avanti" può risultare disabilitato finché non si ripassa di lì —
  // il bottone nativo del browser resta comunque sempre funzionante.
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

    // Nessuno stato (raro: navigazione manuale nella barra indirizzi, o
    // stato salvato da una versione precedente dell'app) — si riparte dal
    // parsing dell'URL corrente.
    const { route, params } = parseLocation();
    this.currentSeq = 0;
    this.notify({ route, params, title: '', seq: 0 });
  };

  /**
   * Da chiamare una volta sola all'avvio (connectedCallback di app-root).
   * Ritorna lo stato iniziale (da `history.state` se già presente — utente
   * arrivato con back/forward o refresh — altrimenti dal parsing dell'URL,
   * per un deep-link diretto) e comincia ad ascoltare i bottoni reali del
   * browser.
   */
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

  /**
   * Naviga verso una route+parametri. `replace: true` aggiorna la voce di
   * history corrente invece di aggiungerne una nuova — da usare per i
   * redirect di permesso (es. accesso negato → dashboard), mai per una vera
   * navigazione scelta dall'utente.
   */
  navigate(
    route: string,
    params: Record<string, string | undefined> = {},
    options: { replace?: boolean; title?: string } = {},
  ): void {
    const cleanedParams = cleanParams(params);
    const title = options.title ?? '';

    // Un cambio di prop innescato dal risultato di una navigazione (es. una
    // pagina reagisce a `openingViewMode` e ri-emette il proprio stato) può
    // richiamare navigate() con lo stesso identico route+params appena
    // applicato: senza questo controllo diventerebbe un passo di history
    // duplicato, invisibile ma capace di rompere "indietro" (due click
    // necessari per uscire da uno stato che ne ha richiesto uno solo per
    // entrarci). Non si applica a un `replace` esplicito, che è comunque
    // innocuo (sovrascrive la stessa voce).
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

  /**
   * Da chiamare a un login fresco: a differenza del vecchio stack in
   * localStorage, la vera history del browser non si può svuotare via JS —
   * qui si azzera solo il contatore avanti/indietro di questa sessione di
   * tab e si sostituisce la voce corrente con la dashboard, così i due
   * bottoni disegnati ripartono puliti (il bottone nativo del browser può
   * comunque tornare a una pagina precedente al login, come qualunque sito).
   */
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
