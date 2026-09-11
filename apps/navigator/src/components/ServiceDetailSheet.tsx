import { MARKER_TYPE_META, type MuseumService } from '@artaround/shared';
import { useI18nStore } from '../context/i18nStore';
import { localizedField } from '../services/i18n';
import { useT } from '../services/useT';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

interface ServiceDetailSheetProps {
  service: MuseumService | null;
  onClose: () => void;
  onViewOnMap: (markerId: string) => void;
}

/** Scheda di dettaglio di un servizio del museo (bar, bagni...) — descrizione
 * e, se collegato, il punto sulla mappa. Condivisa tra MuseumPage e VisitPlayerPage. */
export function ServiceDetailSheet({ service, onClose, onViewOnMap }: ServiceDetailSheetProps) {
  const t = useT();
  const language = useI18nStore((state) => state.language);

  return (
    <Sheet
      open={!!service}
      onClose={onClose}
      title={service ? MARKER_TYPE_META[service.type].label : undefined}
    >
      {service && (
        <div className="space-y-4">
          {service.description && (
            <p className="text-sm text-surface-300 leading-relaxed">
              {localizedField(language, service.description, service.descriptionTranslations)}
            </p>
          )}
          {service.mapMarkerId && (
            <Button
              variant="primary"
              block
              onClick={() => {
                const markerId = service.mapMarkerId!;
                onClose();
                onViewOnMap(markerId);
              }}
            >
              {t('Vedi sulla mappa')}
            </Button>
          )}
        </div>
      )}
    </Sheet>
  );
}
