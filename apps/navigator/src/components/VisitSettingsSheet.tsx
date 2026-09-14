/*
 * File: /src/components/VisitSettingsSheet.tsx                                          *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 14/09/2026                                                             *
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

import { LanguageLevel, ContentDuration, type AppLanguage } from '@artaround/shared';
import { useLanguageLevelMeta } from '../services/useLanguageLevelMeta';
import { useT } from '../services/useT';
import { Chip, Sheet } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PLAYBACK_RATES } from '../services/audioPlayback';

interface VisitSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  activeLanguages: AppLanguage[] | undefined;
  languageLevel: LanguageLevel;
  setLanguageLevel: (level: LanguageLevel) => void;
  contentDuration: ContentDuration;
  setContentDuration: (duration: ContentDuration) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
}

//Modale con le impostazioni della visita
export function VisitSettingsSheet({
  open,
  onClose,
  activeLanguages,
  languageLevel,
  setLanguageLevel,
  contentDuration,
  setContentDuration,
  playbackRate,
  setPlaybackRate,
}: VisitSettingsSheetProps) {
  const t = useT();
  const LEVEL_META = useLanguageLevelMeta();

  const DURATION_META: Record<ContentDuration, { emoji: string; label: string }> = {
    [ContentDuration.FLASH]: { emoji: '⚡', label: t('Flash') },
    [ContentDuration.SHORT]: { emoji: '📝', label: t('Breve') },
    [ContentDuration.MEDIUM]: { emoji: '📖', label: t('Medio') },
    [ContentDuration.LONG]: { emoji: '📚', label: t('Lungo') },
  };
  const DURATION_ORDER = Object.values(ContentDuration);

  return (
    <Sheet open={open} onClose={onClose} title={t('Impostazioni')}>
      <div className="mb-5">
        <p className="text-sm font-medium text-surface-300 mb-2">{t('Lingua')}</p>
        <LanguageSwitcher languages={activeLanguages} />
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-surface-300 mb-2">{t('Livello contenuto')}</p>
        <div className="flex flex-wrap gap-2">
          {Object.values(LanguageLevel).map((level) => (
            <Chip
              key={level}
              selected={languageLevel === level}
              onClick={() => setLanguageLevel(level)}
            >
              {LEVEL_META[level].emoji} {LEVEL_META[level].label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-surface-300 mb-2">{t('Durata descrizione')}</p>
        <div className="flex flex-wrap gap-2">
          {DURATION_ORDER.map((dur) => (
            <Chip
              key={dur}
              selected={contentDuration === dur}
              onClick={() => setContentDuration(dur)}
            >
              {DURATION_META[dur].emoji} {DURATION_META[dur].label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-surface-300 mb-2">{t('Velocità lettura')}</p>
        <div className="flex flex-wrap gap-2">
          {PLAYBACK_RATES.map((rate) => (
            <Chip key={rate} selected={playbackRate === rate} onClick={() => setPlaybackRate(rate)}>
              {rate}×
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-surface-300 mb-2">
          {t('Comandi vocali disponibili')}
        </p>
        <div className="bg-surface-800 rounded-xl p-4 text-sm text-surface-400 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <p>
              <span className="font-semibold text-surface-200">{t('"Prossimo"')}</span> —{' '}
              {t('Avanti')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Precedente"')}</span> —{' '}
              {t('Indietro')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Cos\'è questo"')}</span> —{' '}
              {t('Titolo e autore')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Chi è l\'autore"')}</span> —{' '}
              {t('Autore')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Dimmi di più/meno"')}</span> —{' '}
              {t('Durata')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Non capisco"')}</span> —{' '}
              {t('Livello più semplice')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Dov\'è l\'uscita"')}</span> —{' '}
              {t('Servizi')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Stop"')}</span> —{' '}
              {t('Ferma audio')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Più veloce"')}</span> —{' '}
              {t('Aumenta velocità')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Più lento"')}</span> —{' '}
              {t('Diminuisci velocità')}
            </p>
            <p>
              <span className="font-semibold text-surface-200">{t('"Velocità normale"')}</span> —{' '}
              {t('Ripristina 1×')}
            </p>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
