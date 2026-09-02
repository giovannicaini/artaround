export interface VisitProgress {
  visitId: string;
  visitTitle: string;
  museumId: string;
  coverImage?: string;
  stepIndex: number;
  stepsTotal: number;
  artworkTitle: string;
  updatedAt: number;
}

const KEY = 'navigator:lastVisitProgress';

// avanzamento salvato solo su questo dispositivo, alimenta la card "Riprendi" in Home
export function saveVisitProgress(progress: VisitProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // storage non disponibile: la ripresa semplicemente non verrà proposta
  }
}

export function loadVisitProgress(): VisitProgress | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as VisitProgress) : null;
  } catch {
    return null;
  }
}

export function clearVisitProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignorato
  }
}
