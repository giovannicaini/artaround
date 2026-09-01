import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}

/** Stato "nessun risultato" centralizzato. */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-full bg-surface-800 flex items-center justify-center text-surface-500 [&>svg]:w-7 [&>svg]:h-7">
        {icon}
      </div>
      <h3 className="font-display font-semibold text-surface-50 mb-1.5">{title}</h3>
      {message && <p className="text-surface-400 text-sm mb-4 max-w-xs">{message}</p>}
      {action}
    </div>
  );
}
