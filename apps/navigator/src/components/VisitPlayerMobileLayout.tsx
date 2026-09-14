/*
 * File: /src/components/VisitPlayerMobileLayout.tsx                                     *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 13/09/2026                                                             *
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

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  MoreVertical,
  Maximize2,
  Map as MapIcon,
  Navigation as NavigationIcon,
  Info,
  Mic,
  MicOff,
  List,
} from 'lucide-react';
import type { AppLanguage } from '@artaround/shared';
import type { PlayerStep } from '../context/visitSessionStore';
import { format } from '../services/i18n';
import { useT } from '../services/useT';
import { IconTile, ProgressDots, StepText, PlaybackControls } from './ui';
import { stepImageVariants, stepTextVariants, stepTransition } from './visitStepAnimations';

// Titoli lunghi su più righe: riduce il font invece di lasciarlo fisso.
function titleFontSizeClass(title: string): string {
  if (title.length > 44) return 'text-base';
  if (title.length > 28) return 'text-lg';
  return 'text-xl';
}

export interface VisitPlayerLayoutProps {
  currentStep: PlayerStep | null;
  currentStepIndex: number;
  totalSteps: number;
  stepDirection: number;
  heroImage: string | undefined;
  heroTitle: string;
  heroSubtitle: string;
  showMapVisual: boolean;
  stepMapMarkerId: string | undefined;
  isArtwork: boolean;
  isSpeaking: boolean;
  currentText: string;
  spokenSource: 'step' | 'insight' | 'aside';
  spokenCharIndex: number;
  isListening: boolean;
  isClassifyingVoice: boolean;
  hasAuthorInsight: boolean;
  hasMovementInsight: boolean;
  activeLanguages: AppLanguage[] | undefined;
  onBack: () => void;
  onHome: () => void;
  onOpenMap: (focusMarkerId?: string) => void;
  onPlay: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  onGoToStep: (index: number) => void;
  onVoice: () => void;
  onShowFullscreenImage: () => void;
  onShowFullscreenText: () => void;
  onShowMenu: () => void;
  onShowItemList: () => void;
  onShowQuickActions: () => void;
  onShowSettings: () => void;
  onOpenInsight: () => void;
}

//Layout mobile per il player della visita
export function VisitPlayerMobileLayout({
  currentStep,
  currentStepIndex,
  totalSteps,
  stepDirection,
  heroImage,
  heroTitle,
  heroSubtitle,
  showMapVisual,
  stepMapMarkerId,
  isArtwork,
  isSpeaking,
  currentText,
  spokenSource,
  spokenCharIndex,
  isListening,
  isClassifyingVoice,
  onBack,
  onOpenMap,
  onPlay,
  onPrevStep,
  onNextStep,
  onGoToStep,
  onVoice,
  onShowFullscreenImage,
  onShowFullscreenText,
  onShowMenu,
  onShowItemList,
}: VisitPlayerLayoutProps) {
  const t = useT();

  return (
    <div className="lg:hidden h-full flex flex-col relative">
      <header className="absolute top-0 left-0 right-0 z-20 safe-top">
        <div className="flex items-center justify-between px-4 py-3">
          <IconTile
            icon={<ArrowLeft />}
            variant="glass"
            label={t('Torna indietro')}
            onClick={onBack}
          />
          {/* Pulsante ...*/}
          <IconTile
            icon={<MoreVertical />}
            variant="glass"
            label={t('Menu')}
            onClick={onShowMenu}
          />
        </div>
      </header>

      {/* Altezza fissa */}
      <div className="relative h-[34vh] min-h-[210px] flex-shrink-0 overflow-hidden bg-surface-900">
        <AnimatePresence initial={false}>
          <motion.div
            key={currentStep?.id}
            className="absolute inset-0"
            variants={stepImageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >
            {heroImage ? (
              <>
                <img
                  src={heroImage}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
                />
                <img
                  src={heroImage}
                  alt={heroTitle}
                  onClick={onShowFullscreenImage}
                  className="relative w-full h-full object-contain cursor-pointer"
                />
              </>
            ) : showMapVisual ? (
              <button
                type="button"
                onClick={() => onOpenMap(stepMapMarkerId)}
                className="w-full h-full bg-gradient-to-br from-brand-950 to-surface-950 flex flex-col items-center justify-center gap-3 px-8 text-center"
              >
                <MapIcon className="w-14 h-14 text-brand-500" />
                <span className="text-surface-200 font-medium">{t('Apri la mappa')}</span>
              </button>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-900 to-surface-950 flex items-center justify-center">
                {isArtwork ? (
                  <span className="text-7xl opacity-20">🖼️</span>
                ) : currentStep?.kind === 'navigation' ? (
                  <NavigationIcon className="w-16 h-16 text-brand-800" />
                ) : (
                  <Info className="w-16 h-16 text-brand-800" />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-900 to-transparent pointer-events-none" />

        {heroImage && (
          <IconTile
            icon={<Maximize2 />}
            variant="glass"
            size="sm"
            label={t('Immagine a schermo intero')}
            onClick={onShowFullscreenImage}
            className="absolute bottom-8 right-3"
          />
        )}

        {isSpeaking && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2 px-4 py-2 bg-brand-500 rounded-full shadow-lg">
              <div className="flex items-center gap-0.5 h-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-0.5 h-full bg-surface-950 rounded-full speaking-bar" />
                ))}
              </div>
              <span className="text-surface-950 text-xs font-semibold">{t('In riproduzione')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-6 flex-1 min-h-0 flex flex-col bg-surface-900 rounded-t-3xl shadow-2xl overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col px-5 pt-6 pb-[calc(1.5rem_+_var(--safe-area-inset-bottom))]">
          <AnimatePresence mode="popLayout" custom={stepDirection} initial={false}>
            <motion.div
              key={currentStep?.id}
              className="mb-4 flex-shrink-0"
              custom={stepDirection}
              variants={stepTextVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
            >
              <h1
                className={`font-display font-bold text-surface-50 mb-1 ${titleFontSizeClass(heroTitle)}`}
              >
                {heroTitle}
              </h1>
              <p className="text-surface-400 text-sm">{heroSubtitle}</p>
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="popLayout" custom={stepDirection} initial={false}>
            <motion.div
              key={currentStep?.id}
              className="relative bg-surface-950 rounded-2xl pl-4 pr-11 pb-4 mb-5 flex-1 min-h-0 max-h-28 overflow-y-auto border border-surface-800"
              custom={stepDirection}
              variants={stepTextVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={stepTransition}
            >
              <StepText
                text={currentText}
                active={spokenSource === 'step'}
                spokenCharIndex={spokenCharIndex}
                emptyMessage={t('Nessun contenuto disponibile per questa tappa.')}
                className="text-surface-300 text-sm leading-relaxed"
              />
              {currentText && (
                <IconTile
                  icon={<Maximize2 />}
                  variant="panel"
                  size="sm"
                  label={t('Testo a schermo intero')}
                  onClick={onShowFullscreenText}
                  className="absolute top-2 right-2"
                />
              )}
            </motion.div>
          </AnimatePresence>

          {/* mt-auto: sempre ancorato in fondo al pannello (altezza fissa) */}
          <div className="mt-auto flex-shrink-0">
            {stepMapMarkerId && !showMapVisual && (
              <button
                onClick={() => onOpenMap(stepMapMarkerId)}
                className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-surface-800 text-brand-300 text-xs font-medium hover:bg-surface-700 transition-colors"
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t('Vedi sulla mappa')}
              </button>
            )}

            <div className="mb-4">
              <PlaybackControls
                variant="mobile"
                isSpeaking={isSpeaking}
                canPlay={!!currentText}
                onPlay={onPlay}
                onPrev={onPrevStep}
                onNext={onNextStep}
                prevDisabled={currentStepIndex === 0}
                nextDisabled={currentStepIndex === totalSteps - 1}
              />
            </div>

            <div className="mb-4">
              <ProgressDots total={totalSteps} current={currentStepIndex} onSelect={onGoToStep} />
              <p className="text-surface-400 text-xs mt-1.5 text-center font-medium">
                {format(t('{current} di {total}'), {
                  current: String(currentStepIndex + 1),
                  total: String(totalSteps),
                })}
              </p>
            </div>

            {/* Pulsanti Chiedimi, Tappe, Mappe */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onVoice}
                disabled={isClassifyingVoice}
                className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-full text-xs font-medium transition-all disabled:opacity-60 ${
                  isListening
                    ? 'bg-danger-500 text-surface-950 voice-active'
                    : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                }`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <Mic className="w-4 h-4 flex-shrink-0" />
                )}
                <span className="truncate">
                  {isClassifyingVoice
                    ? t('Capisco...')
                    : isListening
                      ? t('Termina')
                      : t('Chiedimi')}
                </span>
              </button>

              <button
                onClick={onShowItemList}
                className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-full text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all"
              >
                <List className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t('Tappe')}</span>
              </button>

              <button
                onClick={() => onOpenMap()}
                className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-full text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all"
              >
                <MapIcon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{t('Mappa')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
