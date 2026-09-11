import { Lock } from 'lucide-react';
import { Button } from './Button';
import { useT } from '../../services/useT';
import { format } from '../../services/i18n';

interface PurchasePromptProps {
  title: string;
  price: number;
}

/** Invito all'acquisto per una visita a pagamento non ancora posseduta — rimanda al marketplace. */
export function PurchasePrompt({ title, price }: PurchasePromptProps) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="w-14 h-14 mb-4 rounded-2xl bg-brand-500/[.12] flex items-center justify-center">
        <Lock className="w-7 h-7 text-brand-400" />
      </div>
      <h3 className="font-display text-base font-semibold text-surface-50 mb-1.5">{title}</h3>
      <p className="text-surface-400 text-sm mb-5 max-w-xs">
        {format(
          t('Questa visita è a pagamento (€{price}) — acquistala dal marketplace per iniziarla.'),
          {
            price: price.toFixed(2),
          },
        )}
      </p>
      <Button
        variant="primary"
        onClick={() => {
          window.location.href = `${window.location.origin}/marketplace/`;
        }}
      >
        {t('Vai al marketplace')}
      </Button>
    </div>
  );
}
