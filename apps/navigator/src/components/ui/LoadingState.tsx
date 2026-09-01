import { Compass } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
}

/**
 * Stato di caricamento centralizzato — prima riscritto quasi identico in
 * ogni pagina (HomePage, MuseumPage, VisitPlayerPage).
 */
export function LoadingState({ message = 'Caricamento...', fullHeight = true }: LoadingStateProps) {
  return (
    <div
      className={`flex items-center justify-center ${fullHeight ? 'min-h-full' : 'py-16'}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-brand-500/10 flex items-center justify-center">
          <Compass className="w-7 h-7 text-brand-400 animate-[spin_2.5s_linear_infinite]" />
        </div>
        <p className="text-surface-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
