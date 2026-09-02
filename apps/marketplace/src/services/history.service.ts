/**
 * History Service
 * Gestisce la navigazione avanti/indietro tra le pagine del marketplace
 * Salva lo stato in localStorage senza utilizzare le route del browser
 */

export interface HistoryState {
  route: string;
  params: Record<string, string>;
  title: string;
  timestamp: number;
}

interface HistoryData {
  stack: HistoryState[];
  currentIndex: number;
}

const STORAGE_KEY = 'artaround_history';
const CURRENT_STATE_KEY = 'artaround_current_state';
const MAX_HISTORY_SIZE = 50;

class HistoryService {
  private history: HistoryState[] = [];
  private currentIndex = -1;
  private isNavigating = false;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Carica la history da localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: HistoryData = JSON.parse(stored);
        this.history = data.stack || [];
        this.currentIndex = data.currentIndex ?? -1;

        // Valida l'indice
        if (this.currentIndex >= this.history.length) {
          this.currentIndex = this.history.length - 1;
        }
      }
    } catch (e) {
      console.error('Failed to load history from storage:', e);
      this.history = [];
      this.currentIndex = -1;
    }
  }

  /**
   * Salva la history in localStorage
   */
  private saveToStorage(): void {
    try {
      const data: HistoryData = {
        stack: this.history,
        currentIndex: this.currentIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      // Salva anche lo stato corrente separatamente per un accesso rapido
      const currentState = this.getCurrentState();
      if (currentState) {
        localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify(currentState));
      }
    } catch (e) {
      console.error('Failed to save history to storage:', e);
    }
  }

  /**
   * Aggiunge un nuovo stato alla history
   * Chiamato quando l'utente naviga verso una nuova pagina
   */
  push(route: string, params: Record<string, string> = {}, title: string = ''): void {
    // Se stiamo navigando programmaticamente (back/forward), non aggiungere
    if (this.isNavigating) {
      return;
    }

    const newState: HistoryState = {
      route,
      params: { ...params },
      title,
      timestamp: Date.now(),
    };

    // Non aggiungere se è lo stesso stato corrente
    const currentState = this.getCurrentState();
    if (currentState && this.isSameState(currentState, newState)) {
      return;
    }

    // Rimuovi tutti gli stati dopo l'indice corrente (come un browser normale)
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Aggiungi il nuovo stato
    this.history.push(newState);
    this.currentIndex = this.history.length - 1;

    // Limita la dimensione della history
    if (this.history.length > MAX_HISTORY_SIZE) {
      const overflow = this.history.length - MAX_HISTORY_SIZE;
      this.history = this.history.slice(overflow);
      this.currentIndex = Math.max(0, this.currentIndex - overflow);
    }

    this.saveToStorage();
    this.dispatchChangeEvent();
  }

  /**
   * Naviga indietro nella history
   * Restituisce lo stato precedente o null se non disponibile
   */
  back(): HistoryState | null {
    if (!this.canGoBack()) {
      return null;
    }

    this.isNavigating = true;
    this.currentIndex--;
    this.saveToStorage();
    this.dispatchChangeEvent();

    const state = this.getCurrentState();

    // Reset del flag dopo un tick per permettere la navigazione
    setTimeout(() => {
      this.isNavigating = false;
    }, 0);

    return state;
  }

  /**
   * Naviga avanti nella history
   * Restituisce lo stato successivo o null se non disponibile
   */
  forward(): HistoryState | null {
    if (!this.canGoForward()) {
      return null;
    }

    this.isNavigating = true;
    this.currentIndex++;
    this.saveToStorage();
    this.dispatchChangeEvent();

    const state = this.getCurrentState();

    // Reset del flag dopo un tick per permettere la navigazione
    setTimeout(() => {
      this.isNavigating = false;
    }, 0);

    return state;
  }

  /**
   * Verifica se è possibile andare indietro
   */
  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Verifica se è possibile andare avanti
   */
  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Restituisce lo stato corrente
   */
  getCurrentState(): HistoryState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }

  /**
   * Restituisce lo stato salvato (per il ripristino all'avvio)
   */
  getSavedState(): HistoryState | null {
    try {
      const stored = localStorage.getItem(CURRENT_STATE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to get saved state:', e);
    }
    return null;
  }

  /**
   * Restituisce il numero di elementi nella history prima dell'indice corrente
   */
  getBackCount(): number {
    return this.currentIndex;
  }

  /**
   * Restituisce il numero di elementi nella history dopo l'indice corrente
   */
  getForwardCount(): number {
    return this.history.length - 1 - this.currentIndex;
  }

  /**
   * Pulisce tutta la history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_STATE_KEY);
    this.dispatchChangeEvent();
  }

  /**
   * Confronta due stati per verificare se sono uguali
   */
  private isSameState(state1: HistoryState, state2: HistoryState): boolean {
    if (state1.route !== state2.route) {
      return false;
    }

    const params1 = Object.keys(state1.params).sort();
    const params2 = Object.keys(state2.params).sort();

    if (params1.length !== params2.length) {
      return false;
    }

    for (const key of params1) {
      if (state1.params[key] !== state2.params[key]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Dispatch un evento custom per notificare i cambiamenti di stato
   */
  private dispatchChangeEvent(): void {
    window.dispatchEvent(
      new CustomEvent('history-state-changed', {
        detail: {
          canGoBack: this.canGoBack(),
          canGoForward: this.canGoForward(),
          currentState: this.getCurrentState(),
          backCount: this.getBackCount(),
          forwardCount: this.getForwardCount(),
        },
      }),
    );
  }
}

// Istanza singleton
export const historyService = new HistoryService();
