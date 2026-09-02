import { AlertCircle } from 'lucide-react';
import { Button } from './Button';
import { useT } from '../../services/useT';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

/** Stato di errore centralizzato, con azione di ripetizione opzionale. */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-2xl bg-danger-100 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-danger-500" />
      </div>
      <h3 className="font-display text-base font-semibold text-surface-50 mb-1.5">
        {title || t('Qualcosa non ha funzionato')}
      </h3>
      <p className="text-surface-400 text-sm mb-5 max-w-xs">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('Riprova')}
        </Button>
      )}
    </div>
  );
}
