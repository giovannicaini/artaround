import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/** Stato di errore centralizzato, con azione di ripetizione opzionale. */
export function ErrorState({
  title = 'Qualcosa non ha funzionato',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-full bg-danger-100 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-danger-500" />
      </div>
      <h3 className="font-display font-semibold text-surface-50 mb-1.5">{title}</h3>
      <p className="text-surface-400 text-sm mb-5 max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Riprova
        </Button>
      )}
    </div>
  );
}
