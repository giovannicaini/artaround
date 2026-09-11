import { CheckCircle2 } from 'lucide-react';
import type { Visit } from '@artaround/shared';
import { Badge } from './Badge';
import { useT } from '../../services/useT';

interface VisitPriceBadgeProps {
  visit: Visit;
  owned: boolean;
}

/** "Posseduta" se già acquistata, "Gratis" se gratuita, altrimenti il prezzo. */
export function VisitPriceBadge({ visit, owned }: VisitPriceBadgeProps) {
  const t = useT();
  if (owned) {
    return (
      <Badge variant="good" icon={<CheckCircle2 className="w-3 h-3" />}>
        {t('Posseduta')}
      </Badge>
    );
  }
  if (visit.metadata?.isFree) {
    return <Badge variant="good">{t('Gratis')}</Badge>;
  }
  return <Badge variant="neutral">€{visit.metadata?.price?.toFixed(2)}</Badge>;
}
