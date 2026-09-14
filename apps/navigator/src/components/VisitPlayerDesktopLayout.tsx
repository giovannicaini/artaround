/*
 * File: /src/components/VisitPlayerDesktopLayout.tsx                                    *
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
  Home,
  Map as MapIcon,
  Navigation as NavigationIcon,
  Info,
  Settings,
  Mic,
  MicOff,
  List,
  MapPin,
  Maximize2,
} from 'lucide-react';
import { format } from '../services/i18n';
import { useT } from '../services/useT';
import { IconTile, ProgressDots, StepText, PlaybackControls } from './ui';
import { LanguageSwitcher } from './LanguageSwitcher';
import { stepImageVariants, stepTextVariants, stepTransition } from './visitStepAnimations';
import type { VisitPlayerLayoutProps } from './VisitPlayerMobileLayout';

//Layout desktop per il player della visita
export function VisitPlayerDesktopLayout({
  currentStep,
  currentStepIndex,
  totalSteps,
  stepDirection,
  heroImage,
  heroTitle,
  heroSubtitle,
  showMapVisual,
  stepMapMarkerId,
  isSpeaking,
  currentText,
  spokenSource,
  spokenCharIndex,
  isListening,
  isClassifyingVoice,
  hasAuthorInsight,
  hasMovementInsight,
  activeLanguages,
  onBack,
  onHome,
  onOpenMap,
  onPlay,
  onPrevStep,
  onNextStep,
  onGoToStep,
  onVoice,
  onShowFullscreenText,
  onShowItemList,
  onShowQuickActions,
  onShowSettings,
  onOpenInsight,
}: VisitPlayerLayoutProps) {
  const t = useT();

  return (
    <div className="hidden lg:flex h-full">
      <div className="w-1/2 xl:w-3/5 h-full relative bg-surface-900">
        <div className="absolute top-0 left-0 right-0 z-10 p-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-950/45 backdrop-blur-md text-surface-100 hover:bg-surface-950/65 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">{t('Indietro')}</span>
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher languages={activeLanguages} variant="glass" menuAlign="right" />
            <IconTile icon={<Home />} variant="glass" label={t('Home')} onClick={onHome} />
          </div>
        </div>

        <AnimatePresence initial={false}>
          <motion.div
            key={currentStep?.id}
            className="absolute inset-0 flex items-center justify-center p-12"
            variants={stepImageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={stepTransition}
          >
            {heroImage ? (
              <img
                key={heroImage}
                src={heroImage}
                alt={heroTitle}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl opacity-0 transition-opacity duration-300"
                onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
                onError={(e) => e.currentTarget.classList.remove('opacity-0')}
              />
            ) : showMapVisual ? (
              <button
                type="button"
                onClick={() => onOpenMap(stepMapMarkerId)}
                className="w-96 h-96 bg-gradient-to-br from-brand-950 to-surface-800 rounded-2xl flex flex-col items-center justify-center gap-3 px-8 text-center hover:brightness-110 transition-all"
              >
                <MapIcon className="w-20 h-20 text-brand-500" />
                <span className="text-surface-200 font-medium">{t('Apri la mappa')}</span>
              </button>
            ) : (
              <div className="w-96 h-96 bg-surface-800 rounded-2xl flex items-center justify-center">
                {currentStep?.kind === 'navigation' ? (
                  <NavigationIcon className="w-24 h-24 text-brand-800" />
                ) : (
                  <Info className="w-24 h-24 text-brand-800" />
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <ProgressDots total={totalSteps} current={currentStepIndex} onSelect={onGoToStep} />
          <p className="text-surface-500 text-sm text-center mt-2">
            {format(t('Tappa {current} di {total}'), {
              current: String(currentStepIndex + 1),
              total: String(totalSteps),
            })}
          </p>
        </div>
      </div>

      <div className="w-1/2 xl:w-2/5 h-full bg-surface-950 flex flex-col">
        <div className="p-6 border-b border-surface-800">
          <div className="flex items-start justify-between gap-4 mb-4">
            <AnimatePresence mode="popLayout" custom={stepDirection} initial={false}>
              <motion.div
                key={currentStep?.id}
                className="flex-1 min-w-0"
                custom={stepDirection}
                variants={stepTextVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
              >
                <h1 className="font-display text-2xl font-bold text-surface-50 mb-2 leading-tight">
                  {heroTitle}
                </h1>
                <p className="text-sm text-surface-500">{heroSubtitle}</p>
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center gap-2">
              {(hasAuthorInsight || hasMovementInsight) && (
                <IconTile
                  icon={<Info />}
                  variant="panel"
                  label={t('Approfondimento')}
                  onClick={onOpenInsight}
                />
              )}
              <IconTile
                icon={<Settings />}
                variant="panel"
                label={t('Impostazioni')}
                onClick={onShowSettings}
              />
            </div>
          </div>

          {isSpeaking && (
            <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/25 rounded-xl">
              <div className="flex items-center gap-0.5 h-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-0.5 h-full bg-brand-400 rounded-full speaking-bar" />
                ))}
              </div>
              <span className="text-brand-300 text-sm font-medium">{t('In riproduzione...')}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {currentText && (
            <div className="flex justify-end mb-2">
              <IconTile
                icon={<Maximize2 />}
                variant="panel"
                size="sm"
                label={t('Testo a schermo intero')}
                onClick={onShowFullscreenText}
              />
            </div>
          )}
          <AnimatePresence mode="popLayout" custom={stepDirection} initial={false}>
            <motion.div
              key={currentStep?.id}
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
                className="text-surface-300 text-base leading-relaxed"
              />
            </motion.div>
          </AnimatePresence>

          {stepMapMarkerId && !showMapVisual && (
            <button
              onClick={() => onOpenMap(stepMapMarkerId)}
              className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-brand-300 text-xs font-medium hover:bg-surface-800 transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" />
              {t('Vedi sulla mappa')}
            </button>
          )}
        </div>

        <div className="p-6 border-t border-surface-800 bg-surface-900">
          <div className="mb-4">
            <PlaybackControls
              variant="desktop"
              isSpeaking={isSpeaking}
              canPlay={!!currentText}
              onPlay={onPlay}
              onPrev={onPrevStep}
              onNext={onNextStep}
              prevDisabled={currentStepIndex === 0}
              nextDisabled={currentStepIndex === totalSteps - 1}
            />
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onVoice}
              disabled={isClassifyingVoice}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-60 ${
                isListening
                  ? 'bg-danger-500 text-surface-950 voice-active'
                  : 'bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>
                {isClassifyingVoice
                  ? t('Capisco...')
                  : isListening
                    ? t('Termina')
                    : t('Comandi vocali')}
              </span>
            </button>

            <button
              onClick={onShowItemList}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800 transition-all"
            >
              <List className="w-4 h-4" />
              <span>{t('Tutte le tappe')}</span>
            </button>

            <button
              onClick={onShowQuickActions}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800 transition-all"
            >
              <MapPin className="w-4 h-4" />
              <span>{t('Servizi')}</span>
            </button>
          </div>

          <p className="text-xs text-surface-600 text-center mt-4">
            {t('Frecce ← → per navigare, Spazio per play/pausa')}
          </p>
        </div>
      </div>
    </div>
  );
}
