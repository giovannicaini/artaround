import { Info, MapPin, Settings } from 'lucide-react';
import { useT } from '../services/useT';
import { Sheet } from './ui';

interface VisitMenuSheetProps {
  open: boolean;
  onClose: () => void;
  hasAuthorInsight: boolean;
  hasMovementInsight: boolean;
  onOpenInsight: () => void;
  onOpenServices: () => void;
  onOpenSettings: () => void;
}

export function VisitMenuSheet({
  open,
  onClose,
  hasAuthorInsight,
  hasMovementInsight,
  onOpenInsight,
  onOpenServices,
  onOpenSettings,
}: VisitMenuSheetProps) {
  const t = useT();

  return (
    <Sheet open={open} onClose={onClose} title={t('Menu')}>
      <div className="space-y-2">
        {(hasAuthorInsight || hasMovementInsight) && (
          <button
            onClick={() => {
              onClose();
              onOpenInsight();
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
          >
            <Info className="w-5 h-5 text-brand-300" />
            <span className="font-medium">{t('Approfondimento')}</span>
          </button>
        )}
        <button
          onClick={() => {
            onClose();
            onOpenServices();
          }}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
        >
          <MapPin className="w-5 h-5 text-brand-300" />
          <span className="font-medium">{t('Servizi')}</span>
        </button>
        <button
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
        >
          <Settings className="w-5 h-5 text-brand-300" />
          <span className="font-medium">{t('Impostazioni')}</span>
        </button>
      </div>
    </Sheet>
  );
}
