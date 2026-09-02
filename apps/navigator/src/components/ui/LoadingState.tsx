import { Compass } from 'lucide-react';
import { useT } from '../../services/useT';

interface LoadingStateProps {
  message?: string;
  fullHeight?: boolean;
}

export function LoadingState({ message, fullHeight = true }: LoadingStateProps) {
  const t = useT();
  return (
    <div
      className={`flex items-center justify-center ${fullHeight ? 'min-h-full' : 'py-16'}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full gradient-aurora opacity-25 blur-md animate-pulse" />
          <div className="relative w-16 h-16 rounded-full bg-surface-900 border border-surface-800 flex items-center justify-center">
            <Compass className="w-7 h-7 text-brand-300 animate-[spin_2.5s_linear_infinite]" />
          </div>
        </div>
        <p className="text-surface-400 text-sm">{message || t('Caricamento...')}</p>
      </div>
    </div>
  );
}
