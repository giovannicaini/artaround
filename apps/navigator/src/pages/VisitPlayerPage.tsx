/*
 * File: VisitPlayerPage.tsx                                                             *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 12/09/2026                                                             *
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ApiError } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { useVisitSessionStore, type PlayerStep } from '../context/visitSessionStore';
import { speechService, voiceRecognitionService } from '../services/speech';
import { audioPlaybackService } from '../services/audioPlayback';
import {
  getStepText,
  getStepAudio,
  getStepTitle,
  pickItemForPreferences,
  localizedItemText,
} from '../services/content';
import { toSpeechLocale } from '../services/i18n';
import { defaultLanguageLevel, defaultContentDuration } from '../services/personalization';
import { saveVisitProgress, loadVisitProgress } from '../services/visitProgress';
import { loadVisitData } from '../services/loadVisitData';
import { useVoiceCommands } from '../services/useVoiceCommands';
import {
  LanguageLevel,
  ContentDuration,
  getReferenceTypeLabel,
  type GeneratedAudio,
  type MuseumService,
} from '@artaround/shared';
import {
  IconTile,
  Sheet,
  LoadingState,
  ErrorState,
  FullscreenOverlay,
  StepText,
} from '../components/ui';
import { PurchasePrompt } from '../components/PurchasePrompt';
import { ServiceGrid } from '../components/ServiceGrid';
import MapView from '../components/MapView';
import { ServiceDetailSheet } from '../components/ServiceDetailSheet';
import {
  VisitPlayerMobileLayout,
  type VisitPlayerLayoutProps,
} from '../components/VisitPlayerMobileLayout';
import { VisitPlayerDesktopLayout } from '../components/VisitPlayerDesktopLayout';
import { VisitMenuSheet } from '../components/VisitMenuSheet';
import { StepListSheet } from '../components/StepListSheet';
import { VisitSettingsSheet } from '../components/VisitSettingsSheet';
import { InsightSheet } from '../components/InsightSheet';

// Stessa priorità di heroImage, per il prefetch delle tappe adiacenti.
function stepHeroImage(
  step: PlayerStep,
  languageLevel: LanguageLevel,
  contentDuration: ContentDuration,
): string | undefined {
  if (step.kind === 'artwork') return step.artwork.image;
  if (step.kind === 'content') {
    return pickItemForPreferences(step.items, languageLevel, contentDuration)?.image;
  }
  if (step.kind === 'navigation' && step.visual !== 'map') return step.image;
  return undefined;
}

export default function VisitPlayerPage() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const user = useAuthStore((state) => state.user);
  const language = useI18nStore((state) => state.language);
  const t = useT();
  const {
    visit,
    steps,
    currentStepIndex,
    isSpeaking,
    isListening,
    languageLevel,
    contentDuration,
    start,
    goToStep,
    nextStep,
    prevStep,
    setLanguageLevel,
    setContentDuration,
    setSpeaking,
    setListening,
  } = useVisitSessionStore();

  const LEVEL_ORDER = Object.values(LanguageLevel);
  const DURATION_ORDER = Object.values(ContentDuration);

  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [selectedService, setSelectedService] = useState<MuseumService | null>(null);
  const [showItemList, setShowItemList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMap, setShowMap] = useState(false);
  // Marker della mappa associato alla tappa corrente, se il curatore ne ha scelto uno.
  const [mapFocusMarkerId, setMapFocusMarkerId] = useState<string | undefined>();
  const [showFullscreenText, setShowFullscreenText] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  // Fin dove è arrivata la lettura vocale (charIndex)
  const [spokenCharIndex, setSpokenCharIndex] = useState(0);
  // Quale testo a schermo segue spokenCharIndex: tappa, approfondimento, o nessuno (risposta a voce
  // non legata a un testo in vista — 'aside' non evidenzia nulla sullo schermo).
  const [spokenSource, setSpokenSource] = useState<'step' | 'insight' | 'aside'>('step');
  // Scheda approfondimento aperta (autore/movimento), null quando chiusa.
  const [insightType, setInsightType] = useState<'author' | 'movement' | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['visit-player', visitId],
    queryFn: () => loadVisitData(visitId!),
    enabled: !!visitId,
  });

  // Una volta caricata, entra nello store di sessione con i default proposti dall'utente —
  // riprendendo dalla tappa salvata se il progresso su questo dispositivo è di questa visita.
  useEffect(() => {
    if (!data) return;
    const progress = loadVisitProgress();
    start(
      data.visit,
      data.steps,
      {
        languageLevel: defaultLanguageLevel(user?.preferences),
        contentDuration: defaultContentDuration(user?.preferences),
      },
      progress?.visitId === data.visit._id ? progress.stepIndex : 0,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const currentStep = steps[currentStepIndex] ?? null;

  // Verso della transizione (1 avanti, -1 indietro), dedotto dal confronto con l'indice precedente.
  const prevStepIndexRef = useRef(currentStepIndex);
  const [stepDirection, setStepDirection] = useState(1);
  useEffect(() => {
    if (currentStepIndex !== prevStepIndexRef.current) {
      setStepDirection(currentStepIndex > prevStepIndexRef.current ? 1 : -1);
      prevStepIndexRef.current = currentStepIndex;
    }
  }, [currentStepIndex]);

  // Salva l'avanzamento in localStorage per la card "Riprendi" in Home.
  useEffect(() => {
    if (!visit || !currentStep) return;
    saveVisitProgress({
      visitId: visit._id,
      visitTitle: visit.title,
      museumId: visit.museumId as string,
      coverImage: visit.coverImage,
      stepIndex: currentStepIndex,
      stepsTotal: steps.length,
      artworkTitle: currentStep.kind === 'artwork' ? currentStep.artwork.title : visit.title,
      updatedAt: Date.now(),
    });
  }, [visit, currentStep, currentStepIndex, steps.length]);

  // Precarica le immagini delle tappe adiacenti: la prima volta non sono ancora in cache.
  useEffect(() => {
    for (const step of [steps[currentStepIndex - 1], steps[currentStepIndex + 1]]) {
      if (!step) continue;
      const url = stepHeroImage(step, languageLevel, contentDuration);
      if (url) new Image().src = url;
    }
  }, [steps, currentStepIndex, languageLevel, contentDuration]);

  const currentText = currentStep
    ? getStepText(currentStep, languageLevel, contentDuration, language)
    : '';
  // undefined se il curatore non ha ancora generato l'audio mp3 per questa lingua: usa la sintesi vocale del browser
  const currentAudio = currentStep
    ? getStepAudio(currentStep, languageLevel, contentDuration, language)
    : undefined;

  // Url dell'audio lasciato in pausa da handlePlay, per capire se riprendere da lì o ripartire.
  const pausedAudioUrlRef = useRef<string | null>(null);

  // Ferma qualunque backend stia suonando.
  const stopBackends = useCallback(() => {
    speechService.stop();
    audioPlaybackService.stop();
    pausedAudioUrlRef.current = null;
  }, []);

  // Ferma la lettura e riporta i controlli a "non in riproduzione"
  const stopPlayback = useCallback(() => {
    stopBackends();
    setSpeaking(false);
    setSpokenCharIndex(0);
  }, [stopBackends, setSpeaking]);

  // Legge un testo: usa l'audio generato se c'è, altrimenti la sintesi vocale del browser.
  // source dice quale testo a schermo evidenziare (tappa corrente o scheda approfondimento).
  const speak = useCallback(
    (text: string, audio?: GeneratedAudio, source: 'step' | 'insight' | 'aside' = 'step') => {
      stopBackends();
      setSpokenCharIndex(0);
      setSpokenSource(source);

      const handleEnd = () => {
        setSpeaking(false);
        setSpokenCharIndex(0);
        pausedAudioUrlRef.current = null;
      };

      if (audio) {
        audioPlaybackService.play(audio, { onBoundary: setSpokenCharIndex, onEnd: handleEnd });
      } else {
        speechService.onEnd(handleEnd);
        speechService.speak(text, {
          lang: toSpeechLocale(language),
          onBoundary: setSpokenCharIndex,
        });
      }
      setSpeaking(true);
    },
    [setSpeaking, language, stopBackends],
  );

  // Se si cambia tappa mentre l'audioguida sta ancora leggendo, riparte subito sulla nuova tappa.
  // Se invece era in pausa, l'evidenziazione della tappa precedente non deve restare sul testo nuovo.
  const prevStepIdRef = useRef(currentStep?.id);
  useEffect(() => {
    if (currentStep?.id === prevStepIdRef.current) return;
    prevStepIdRef.current = currentStep?.id;
    if (!isSpeaking) {
      setSpokenCharIndex(0);
      pausedAudioUrlRef.current = null;
      return;
    }
    if (currentText) {
      speak(currentText, currentAudio);
    } else {
      stopPlayback();
    }
  }, [currentStep?.id, isSpeaking, currentText, currentAudio, speak, stopPlayback]);

  // Apre la mappa, opzionalmente centrata su un marker.
  const openMap = useCallback((focusMarkerId?: string) => {
    setMapFocusMarkerId(focusMarkerId);
    setShowMap(true);
  }, []);

  const handlePlay = useCallback(() => {
    if (!currentText) return;
    if (isSpeaking) {
      // Audio generato: pausa vera. Sintesi vocale del browser: nessuna pausa affidabile, si riparte da capo.
      if (currentAudio) {
        audioPlaybackService.pause();
        pausedAudioUrlRef.current = currentAudio.url;
        setSpeaking(false);
      } else {
        stopPlayback();
      }
    } else if (currentAudio && pausedAudioUrlRef.current === currentAudio.url) {
      // Stesso audio lasciato in pausa su questa stessa tappa: riprende da
      // dove si era fermato invece di ripartire dall'inizio.
      audioPlaybackService.resume();
      setSpeaking(true);
    } else {
      speak(currentText, currentAudio);
    }
  }, [currentText, currentAudio, isSpeaking, setSpeaking, speak, stopPlayback]);

  const shiftLevel = useCallback(
    (delta: number) => {
      const idx = LEVEL_ORDER.indexOf(languageLevel);
      const next = LEVEL_ORDER[Math.min(LEVEL_ORDER.length - 1, Math.max(0, idx + delta))];
      setLanguageLevel(next);
    },
    [languageLevel, setLanguageLevel, LEVEL_ORDER],
  );

  const shiftDuration = useCallback(
    (delta: number) => {
      const idx = DURATION_ORDER.indexOf(contentDuration);
      const next = DURATION_ORDER[Math.min(DURATION_ORDER.length - 1, Math.max(0, idx + delta))];
      setContentDuration(next);
    },
    [contentDuration, setContentDuration, DURATION_ORDER],
  );

  const { handleVoice, isClassifyingVoice } = useVoiceCommands({
    currentStep,
    currentText,
    languageLevel,
    contentDuration,
    language,
    activeServices: data?.activeServices,
    isListening,
    setListening,
    nextStep,
    prevStep,
    handlePlay,
    stopBackends,
    stopPlayback,
    shiftDuration,
    shiftLevel,
    speak,
    setSelectedService,
    setInsightType,
    setShowSettings,
    setShowQuickActions,
  });

  useEffect(() => {
    voiceRecognitionService.setLanguage(toSpeechLocale(language));
  }, [language]);

  useEffect(() => {
    return () => {
      stopBackends();
      voiceRecognitionService.stop();
    };
  }, [stopBackends]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextStep();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevStep();
      if (e.key === ' ') {
        e.preventDefault();
        handlePlay();
      }
      if (e.key === 'Escape') {
        stopPlayback();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextStep, prevStep, handlePlay, stopPlayback]);

  const sessionReady = !!data && visit?._id === data.visit._id && !!currentStep;

  if (isLoading || (data && !sessionReady)) {
    return <LoadingState message={t('Preparo la visita...')} />;
  }

  // Visita a pagamento non posseduta: invito all'acquisto.
  if (error instanceof ApiError && error.code === 'PURCHASE_REQUIRED') {
    const info = error.data as { title?: string; price?: number } | undefined;
    return (
      <div className="h-full flex items-center justify-center bg-surface-950 px-6">
        <PurchasePrompt title={info?.title || visitId || ''} price={info?.price || 0} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-950 px-6">
        <ErrorState
          message={error instanceof Error ? error.message : t('Impossibile caricare la visita.')}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const artworkStep = currentStep?.kind === 'artwork' ? currentStep : null;
  const isArtwork = !!artworkStep;
  const hasAuthorInsight = !!artworkStep?.authorItems?.length;
  const hasMovementInsight = !!artworkStep?.movementItems?.length;
  // Contenuto della scheda approfondimento aperta, sugli item autore/movimento invece che sull'opera.
  const insightItems =
    insightType === 'author'
      ? artworkStep?.authorItems
      : insightType === 'movement'
        ? artworkStep?.movementItems
        : undefined;
  const insightItem = insightItems
    ? pickItemForPreferences(insightItems, languageLevel, contentDuration)
    : null;
  const insightText = insightItem ? localizedItemText(insightItem, language) : '';
  const contentStep = currentStep?.kind === 'content' ? currentStep : null;
  // Stesso item scelto da getStepText/getStepAudio — serve anche per titolo/immagine dell'hero.
  const contentItem = contentStep
    ? pickItemForPreferences(contentStep.items, languageLevel, contentDuration)
    : null;
  const logisticStep = currentStep?.kind === 'logistic' ? currentStep : null;
  const navigationStep = currentStep?.kind === 'navigation' ? currentStep : null;
  // true se il curatore ha scelto la mappa integrata al posto di un'immagine per questa tappa.
  const showMapVisual = navigationStep?.visual === 'map';
  // Marker associato alla tappa: per "Vedi sulla mappa" e per centrare la mappa integrata.
  const stepMapMarkerId =
    logisticStep?.mapMarkerId || navigationStep?.mapMarkerId || contentStep?.mapMarkerId;
  const heroImage =
    artworkStep?.artwork.image ||
    contentItem?.image ||
    (navigationStep && !showMapVisual ? navigationStep.image : undefined);
  const heroTitle = artworkStep
    ? artworkStep.artwork.title
    : contentStep
      ? contentItem?.title || getReferenceTypeLabel(contentStep.referenceType)
      : currentStep?.kind === 'logistic'
        ? getStepTitle(currentStep, language)
        : t('Indicazioni');
  const heroSubtitle = artworkStep
    ? [artworkStep.artwork.author, artworkStep.artwork.style || artworkStep.artwork.movement]
        .filter(Boolean)
        .join(' • ')
    : contentStep
      ? getReferenceTypeLabel(contentStep.referenceType)
      : currentStep?.kind === 'logistic'
        ? t('Informazioni sulla visita')
        : t('Dove andare ora');

  const layoutProps: VisitPlayerLayoutProps = {
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
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
    hasAuthorInsight,
    hasMovementInsight,
    activeLanguages: data?.activeLanguages,
    onBack: () => navigate(-1),
    onHome: () => navigate('/'),
    onOpenMap: openMap,
    onPlay: handlePlay,
    onPrevStep: prevStep,
    onNextStep: nextStep,
    onGoToStep: goToStep,
    onVoice: handleVoice,
    onShowFullscreenImage: () => setShowFullscreenImage(true),
    onShowFullscreenText: () => setShowFullscreenText(true),
    onShowMenu: () => setShowMenu(true),
    onShowItemList: () => setShowItemList(true),
    onShowQuickActions: () => setShowQuickActions(true),
    onShowSettings: () => setShowSettings(true),
    onOpenInsight: () => setInsightType(hasAuthorInsight ? 'author' : 'movement'),
  };

  return (
    <div className="h-full bg-surface-950">
      <VisitPlayerMobileLayout {...layoutProps} />
      <VisitPlayerDesktopLayout {...layoutProps} />

      <VisitMenuSheet
        open={showMenu}
        onClose={() => setShowMenu(false)}
        hasAuthorInsight={hasAuthorInsight}
        hasMovementInsight={hasMovementInsight}
        onOpenInsight={() => setInsightType(hasAuthorInsight ? 'author' : 'movement')}
        onOpenServices={() => setShowQuickActions(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <StepListSheet
        open={showItemList}
        onClose={() => setShowItemList(false)}
        steps={steps}
        currentStepIndex={currentStepIndex}
        languageLevel={languageLevel}
        contentDuration={contentDuration}
        onGoToStep={goToStep}
      />

      {/* Servizi rapidi — solo quelli attivati dal curatore per questo museo. */}
      <Sheet
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        title={t('Servizi del museo')}
      >
        <ServiceGrid
          services={data?.activeServices || []}
          onSelect={(service) => {
            setShowQuickActions(false);
            setSelectedService(service);
          }}
          emptyMessage={t('Nessun servizio segnalato per questo museo.')}
        />
      </Sheet>

      <ServiceDetailSheet
        service={selectedService}
        onClose={() => setSelectedService(null)}
        onViewOnMap={(markerId) => openMap(markerId)}
      />

      <VisitSettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        activeLanguages={data?.activeLanguages}
        languageLevel={languageLevel}
        setLanguageLevel={setLanguageLevel}
        contentDuration={contentDuration}
        setContentDuration={setContentDuration}
      />

      <InsightSheet
        insightType={insightType}
        setInsightType={setInsightType}
        hasAuthorInsight={hasAuthorInsight}
        hasMovementInsight={hasMovementInsight}
        insightItem={insightItem}
        insightText={insightText}
        isSpeaking={isSpeaking}
        spokenSource={spokenSource}
        spokenCharIndex={spokenCharIndex}
        language={language}
        stopPlayback={stopPlayback}
        speak={speak}
      />

      {/* Mappa */}
      {showMap && (
        <MapView
          map={
            data.museumMap || {
              type: 'image',
              imageUrl: '',
              dimensions: { width: 800, height: 600 },
              markers: [],
            }
          }
          inVisit={true}
          routePoints={data.routePoints}
          artworkInfo={data.artworkInfo}
          currentArtworkId={artworkStep?.artwork.wikidataId}
          focusMarkerId={mapFocusMarkerId}
          visitArtworkIds={steps
            .filter((s): s is Extract<PlayerStep, { kind: 'artwork' }> => s.kind === 'artwork')
            .map((s) => s.artwork.wikidataId)}
          onMarkerClick={(marker) => {
            // Conta solo che il marker porti a un'opera della visita, non il suo tipo/icona.
            if (marker.artworkId) {
              const idx = steps.findIndex(
                (s) => s.kind === 'artwork' && s.artwork.wikidataId === marker.artworkId,
              );
              if (idx >= 0) {
                goToStep(idx);
                setShowMap(false);
              }
            }
          }}
          onClose={() => {
            setShowMap(false);
            setMapFocusMarkerId(undefined);
          }}
        />
      )}

      {/* Testo a schermo intero */}
      <AnimatePresence>
        {showFullscreenText && (
          <FullscreenOverlay className="flex flex-col safe-top safe-bottom">
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-surface-800">
              <h1 className="font-display text-lg font-bold text-surface-50 leading-tight">
                {heroTitle}
              </h1>
              <IconTile
                icon={<X />}
                variant="panel"
                label={t('Chiudi')}
                onClick={() => setShowFullscreenText(false)}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-8">
              <StepText
                text={currentText}
                active={spokenSource === 'step'}
                spokenCharIndex={spokenCharIndex}
                emptyMessage={t('Nessun contenuto disponibile per questa tappa.')}
                className="text-2xl sm:text-3xl leading-relaxed text-surface-200 max-w-3xl mx-auto"
              />
            </div>
          </FullscreenOverlay>
        )}
      </AnimatePresence>

      {/* Immagine a schermo intero, aperta toccando l'opera */}
      <AnimatePresence>
        {showFullscreenImage && heroImage && (
          <FullscreenOverlay
            className="flex items-center justify-center"
            onClick={() => setShowFullscreenImage(false)}
          >
            <img src={heroImage} alt={heroTitle} className="max-w-full max-h-full object-contain" />
            <IconTile
              icon={<X />}
              variant="glass"
              label={t('Chiudi')}
              onClick={() => setShowFullscreenImage(false)}
              className="absolute top-4 right-4 safe-top"
            />
          </FullscreenOverlay>
        )}
      </AnimatePresence>
    </div>
  );
}
