// navigazione avanti/indietro tra le pagine del marketplace, salvata in
// localStorage invece di usare le route del browser

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

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: HistoryData = JSON.parse(stored);
        this.history = data.stack || [];
        this.currentIndex = data.currentIndex ?? -1;

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

  private saveToStorage(): void {
    try {
      const data: HistoryData = {
        stack: this.history,
        currentIndex: this.currentIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

      const currentState = this.getCurrentState();
      if (currentState) {
        localStorage.setItem(CURRENT_STATE_KEY, JSON.stringify(currentState));
      }
    } catch (e) {
      console.error('Failed to save history to storage:', e);
    }
  }

  push(route: string, params: Record<string, string> = {}, title: string = ''): void {
    // se stiamo navigando con back/forward non riaggiungo lo stato
    if (this.isNavigating) {
      return;
    }

    const newState: HistoryState = {
      route,
      params: { ...params },
      title,
      timestamp: Date.now(),
    };

    const currentState = this.getCurrentState();
    if (currentState && this.isSameState(currentState, newState)) {
      return;
    }

    // come un browser vero: navigare da metà stack taglia il resto
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    this.history.push(newState);
    this.currentIndex = this.history.length - 1;

    if (this.history.length > MAX_HISTORY_SIZE) {
      const overflow = this.history.length - MAX_HISTORY_SIZE;
      this.history = this.history.slice(overflow);
      this.currentIndex = Math.max(0, this.currentIndex - overflow);
    }

    this.saveToStorage();
    this.dispatchChangeEvent();
  }

  back(): HistoryState | null {
    if (!this.canGoBack()) {
      return null;
    }

    this.isNavigating = true;
    this.currentIndex--;
    this.saveToStorage();
    this.dispatchChangeEvent();

    const state = this.getCurrentState();
    setTimeout(() => {
      this.isNavigating = false;
    }, 0);

    return state;
  }

  forward(): HistoryState | null {
    if (!this.canGoForward()) {
      return null;
    }

    this.isNavigating = true;
    this.currentIndex++;
    this.saveToStorage();
    this.dispatchChangeEvent();

    const state = this.getCurrentState();
    setTimeout(() => {
      this.isNavigating = false;
    }, 0);

    return state;
  }

  canGoBack(): boolean {
    return this.currentIndex > 0;
  }

  canGoForward(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getCurrentState(): HistoryState | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }

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

  getBackCount(): number {
    return this.currentIndex;
  }

  getForwardCount(): number {
    return this.history.length - 1 - this.currentIndex;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CURRENT_STATE_KEY);
    this.dispatchChangeEvent();
  }

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

export const historyService = new HistoryService();
