/*
 * File: /src/components/ServiceDetailSheet.tsx                                          *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

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

// Scheda di dettaglio di un servizio del museo (bar, bagni...) — descrizione + eventuale link alla mappa
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
