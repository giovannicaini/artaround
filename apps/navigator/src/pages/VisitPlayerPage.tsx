import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic,
  MicOff,
  MapPin,
  Map as MapIcon,
  Coffee,
  ShoppingBag,
  DoorOpen,
  HelpCircle,
  Accessibility,
  Settings,
  List,
  ChevronLeft,
  ChevronRight,
  Info,
  Navigation as NavigationIcon,
  Home,
} from 'lucide-react';
import { api } from '../lib/apiClient';
import { useAuthStore } from '../stores/authStore';
import { useI18nStore } from '../stores/i18nStore';
import { useT } from '../hooks/useT';
import { useMuseumTheme } from '../hooks/useMuseumTheme';
import { useVisitSessionStore, type PlayerStep } from '../stores/visitSessionStore';
import { speechService, voiceRecognitionService, parseVoiceCommand } from '../services/speech';
import { getStepText } from '../lib/content';
import { format, toSpeechLocale } from '../lib/i18n';
import { defaultLanguageLevel, defaultContentDuration } from '../lib/personalization';
import { saveVisitProgress } from '../lib/visitProgress';
import {
  LanguageLevel,
  ContentDuration,
  VisitStepType,
  type Item,
  type MuseumMap,
  type Visit,
  type Artwork,
} from '@artaround/shared';
import {
  IconTile,
  Sheet,
  ProgressDots,
  LoadingState,
  ErrorState,
  LanguageSwitcher,
} from '../components/ui';
import MapView from '../components/MapView';

async function loadVisitData(visitId: string): Promise<{
  visit: Visit;
  steps: PlayerStep[];
  museumMap: MuseumMap | null;
}> {
  const visit = await api.getVisit(visitId);
  if (!visit.steps || visit.steps.length === 0) {
    throw new Error('Questa visita non contiene tappe.');
  }

  let museumMap: MuseumMap | null = null;
  if (visit.museumId) {
    try {
      const museum = await api.getMuseum(visit.museumId as string);
      const firstFloor = museum.floors?.[0];
      if (firstFloor) {
        museumMap = {
          type: 'svg',
          svgContent: firstFloor.svgContent,
          dimensions: firstFloor.dimensions,
          markers: firstFloor.markers,
          floors: museum.floors,
        };
      }
    } catch {
      // La mappa è un'aggiunta, non un requisito: la visita resta fruibile senza.
    }
  }

  const orderedSteps = [...visit.steps]
    .filter((step) => step.type !== VisitStepType.WAYPOINT)
    .sort((a, b) => a.order - b.order);

  const artworkStepDefs = orderedSteps.filter(
    (step) => step.type === VisitStepType.ARTWORK && step.artworkId,
  );
  const artworkIds = [...new Set(artworkStepDefs.map((s) => s.artworkId!))];

  const artworks = await Promise.all(
    artworkIds.map(async (id) => {
      try {
        return await api.getArtwork(id);
      } catch {
        return null;
      }
    }),
  );
  const artworksById: Record<string, Artwork> = {};
  artworks.forEach((artwork) => {
    if (artwork) {
      artworksById[artwork.wikidataId] = artwork;
      artworksById[artwork._id] = artwork;
    }
  });

  const itemsByArtworkId: Record<string, Item[]> = {};
  await Promise.all(
    artworkIds.map(async (id) => {
      try {
        itemsByArtworkId[id] = await api.getItemsForArtwork(id);
      } catch {
        itemsByArtworkId[id] = [];
      }
    }),
  );

  const steps: PlayerStep[] = orderedSteps
    .map((step): PlayerStep | null => {
      if (step.type === VisitStepType.ARTWORK && step.artworkId) {
        const artwork = artworksById[step.artworkId];
        if (!artwork) return null;
        return {
          kind: 'artwork',
          id: step.id,
          artwork,
          items: itemsByArtworkId[step.artworkId] || [],
        };
      }
      if (step.type === VisitStepType.LOGISTIC) {
        return {
          kind: 'logistic',
          id: step.id,
          title: step.logisticTitle || 'Informazioni utili',
          text: step.logisticText || '',
          icon: step.logisticIcon,
        };
      }
      if (step.type === VisitStepType.NAVIGATION) {
        return {
          kind: 'navigation',
          id: step.id,
          text: step.navigationText || '',
          image: step.navigationImage,
        };
      }
      return null;
    })
    .filter((s): s is PlayerStep => s !== null);

  if (steps.length === 0) {
    throw new Error('Impossibile caricare le tappe di questa visita.');
  }

  return { visit, steps, museumMap };
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
  useMuseumTheme(visit?.museumId as string | undefined);

  const DURATION_META: Record<ContentDuration, { emoji: string; label: string }> = {
    [ContentDuration.FLASH]: { emoji: '⚡', label: t('Flash') },
    [ContentDuration.SHORT]: { emoji: '📝', label: t('Breve') },
    [ContentDuration.MEDIUM]: { emoji: '📖', label: t('Medio') },
    [ContentDuration.LONG]: { emoji: '📚', label: t('Lungo') },
    [ContentDuration.EXTENDED]: { emoji: '🎓', label: t('Completo') },
  };
  const DURATION_ORDER = Object.values(ContentDuration);

  const LEVEL_META: Record<LanguageLevel, { emoji: string; label: string }> = {
    [LanguageLevel.CHILDREN]: { emoji: '👶', label: t('Bambini') },
    [LanguageLevel.ELEMENTARY]: { emoji: '🌱', label: t('Base') },
    [LanguageLevel.MEDIUM]: { emoji: '🌿', label: t('Intermedio') },
    [LanguageLevel.SPECIALIST]: { emoji: '🌳', label: t('Esperto') },
  };
  const LEVEL_ORDER = Object.values(LanguageLevel);

  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showItemList, setShowItemList] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['visit-player', visitId],
    queryFn: () => loadVisitData(visitId!),
    enabled: !!visitId,
  });

  // Una volta caricata, la visita entra nello store di sessione con i
  // default di livello/durata proposti dalle preferenze dell'utente.
  useEffect(() => {
    if (!data) return;
    start(data.visit, data.steps, {
      languageLevel: defaultLanguageLevel(user?.preferences),
      contentDuration: defaultContentDuration(user?.preferences),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const currentStep = steps[currentStepIndex] ?? null;

  // Salva l'avanzamento per la card "Riprendi" in Home.
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

  const currentText = currentStep
    ? getStepText(currentStep, languageLevel, contentDuration, language)
    : '';

  const speak = useCallback(
    (text: string) => {
      speechService.stop();
      speechService.onEnd(() => setSpeaking(false));
      speechService.speak(text, { lang: toSpeechLocale(language) });
      setSpeaking(true);
    },
    [setSpeaking, language],
  );

  const handlePlay = useCallback(() => {
    if (!currentText) return;
    if (isSpeaking) {
      speechService.stop();
      setSpeaking(false);
    } else {
      speak(currentText);
    }
  }, [currentText, isSpeaking, setSpeaking, speak]);

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

  const handleVoiceCommand = useCallback(
    (command: string) => {
      switch (command) {
        case 'next':
          nextStep();
          break;
        case 'prev':
          prevStep();
          break;
        case 'play':
          handlePlay();
          break;
        case 'stop':
          speechService.stop();
          setSpeaking(false);
          break;
        case 'whatIsThis':
          if (currentStep?.kind === 'artwork') {
            const { title, author } = currentStep.artwork;
            speak(author ? format(t('{title}, di {author}.'), { title, author }) : title);
          } else if (currentText) {
            speak(currentText);
          }
          break;
        case 'more':
          shiftDuration(1);
          break;
        case 'less':
          shiftDuration(-1);
          break;
        case 'tooHard':
          shiftLevel(-1);
          break;
        case 'tooSimple':
          shiftLevel(1);
          break;
        case 'author':
          if (currentStep?.kind === 'artwork') {
            speak(
              currentStep.artwork.author
                ? format(t("L'autore è {author}."), { author: currentStep.artwork.author })
                : t("Non ho informazioni sull'autore di quest'opera."),
            );
          }
          break;
        case 'style': {
          if (currentStep?.kind === 'artwork') {
            const style = currentStep.artwork.style || currentStep.artwork.movement;
            speak(
              style
                ? format(t('Lo stile è {style}.'), { style })
                : t("Non ho informazioni sullo stile di quest'opera."),
            );
          }
          break;
        }
        case 'repeat':
          speechService.stop();
          setTimeout(() => handlePlay(), 100);
          break;
        case 'exit':
        case 'toilette':
        case 'bar':
        case 'shop':
        case 'obstacles':
        default:
          setShowQuickActions(true);
      }
    },
    [
      currentStep,
      currentText,
      handlePlay,
      nextStep,
      prevStep,
      setSpeaking,
      shiftDuration,
      shiftLevel,
      speak,
      t,
    ],
  );

  const handleVoice = useCallback(() => {
    if (isListening) {
      voiceRecognitionService.stop();
      setListening(false);
    } else {
      setListening(true);
      voiceRecognitionService.start(
        (text) => {
          const command = parseVoiceCommand(text);
          if (command) handleVoiceCommand(command);
          setListening(false);
        },
        () => setListening(false),
      );
    }
  }, [isListening, setListening, handleVoiceCommand]);

  useEffect(() => {
    return () => {
      speechService.stop();
      voiceRecognitionService.stop();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextStep();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prevStep();
      if (e.key === ' ') {
        e.preventDefault();
        handlePlay();
      }
      if (e.key === 'Escape') {
        speechService.stop();
        setSpeaking(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextStep, prevStep, handlePlay, setSpeaking]);

  const sessionReady = !!data && visit?._id === data.visit._id && !!currentStep;

  if (isLoading || (data && !sessionReady)) {
    return <LoadingState message={t('Preparo la visita...')} />;
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
  const heroImage = artworkStep?.artwork.image;
  const heroTitle = artworkStep
    ? artworkStep.artwork.title
    : currentStep?.kind === 'logistic'
      ? currentStep.title
      : t('Indicazioni');
  const heroSubtitle = artworkStep
    ? [artworkStep.artwork.author, artworkStep.artwork.style || artworkStep.artwork.movement]
        .filter(Boolean)
        .join(' • ')
    : currentStep?.kind === 'logistic'
      ? t('Informazioni sulla visita')
      : t('Dove andare ora');

  return (
    <div className="h-full bg-surface-950">
      {/* MOBILE LAYOUT */}
      <div className="lg:hidden h-full flex flex-col relative">
        <header className="absolute top-0 left-0 right-0 z-20 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <IconTile
              icon={<ArrowLeft />}
              variant="glass"
              label={t('Torna indietro')}
              onClick={() => navigate(-1)}
            />
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="glass" />
              <IconTile
                icon={<List />}
                variant="glass"
                label={t('Lista tappe')}
                onClick={() => setShowItemList(true)}
              />
              <IconTile
                icon={<Settings />}
                variant="glass"
                label={t('Impostazioni')}
                onClick={() => setShowSettings(true)}
              />
            </div>
          </div>
        </header>

        <div className="flex-1 relative" onClick={() => setShowControls((v) => !v)}>
          <div className="absolute inset-0">
            {heroImage ? (
              <img src={heroImage} alt={heroTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-900 to-surface-950 flex items-center justify-center">
                {isArtwork ? (
                  <span className="text-8xl opacity-20">🖼️</span>
                ) : currentStep?.kind === 'navigation' ? (
                  <NavigationIcon className="w-20 h-20 text-brand-800" />
                ) : (
                  <Info className="w-20 h-20 text-brand-800" />
                )}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-surface-950 via-surface-950/25 to-surface-950/45" />
          </div>

          <div className="absolute top-20 left-4 right-4">
            <ProgressDots total={steps.length} current={currentStepIndex} onSelect={goToStep} />
            <p className="text-surface-400 text-xs mt-2 text-center font-medium">
              {format(t('{current} di {total}'), {
                current: String(currentStepIndex + 1),
                total: String(steps.length),
              })}
            </p>
          </div>

          {isSpeaking && (
            <div className="absolute top-36 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 px-4 py-2 bg-brand-500 rounded-full shadow-lg">
                <div className="flex items-center gap-0.5 h-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="w-0.5 h-full bg-surface-950 rounded-full speaking-bar"
                    />
                  ))}
                </div>
                <span className="text-surface-950 text-xs font-semibold">
                  {t('In riproduzione')}
                </span>
              </div>
            </div>
          )}
        </div>

        <div
          className={`relative z-10 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-[calc(100%-4rem)]'}`}
        >
          <div className="px-5 pb-4">
            <h1 className="font-display text-xl font-bold text-surface-50 mb-1 drop-shadow-lg">
              {heroTitle}
            </h1>
            <p className="text-surface-400 text-sm">{heroSubtitle}</p>
          </div>

          <div className="bg-surface-900 border-t border-surface-800 rounded-t-3xl px-5 pt-5 pb-6 safe-bottom shadow-2xl">
            {isArtwork && (
              <div className="flex gap-1.5 mb-4 overflow-x-auto">
                {Object.values(ContentDuration).map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setContentDuration(dur)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                      contentDuration === dur
                        ? 'gradient-aurora text-white'
                        : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                    }`}
                  >
                    {DURATION_META[dur].emoji} {DURATION_META[dur].label}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-surface-950 rounded-2xl p-4 mb-5 max-h-28 overflow-y-auto border border-surface-800">
              <p className="text-surface-300 text-sm leading-relaxed">
                {currentText || t('Nessun contenuto disponibile per questa tappa.')}
              </p>
            </div>

            <div className="flex items-center justify-center gap-5 mb-4">
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="p-3.5 rounded-full bg-surface-800 text-surface-300 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={handlePlay}
                disabled={!currentText}
                className="p-6 rounded-full gradient-aurora text-white shadow-glow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-40"
              >
                {isSpeaking ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>

              <button
                onClick={nextStep}
                disabled={currentStepIndex === steps.length - 1}
                className="p-3.5 rounded-full bg-surface-800 text-surface-300 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleVoice}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-danger-500 text-surface-950 voice-active'
                    : 'bg-surface-800 text-surface-300 hover:bg-surface-700'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? t('Termina') : t('Voce')}</span>
              </button>

              <button
                onClick={() => setShowQuickActions(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all"
              >
                <MapPin className="w-4 h-4" />
                <span>{t('Servizi')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT */}
      <div className="hidden lg:flex h-full">
        <div className="w-1/2 xl:w-3/5 h-full relative bg-surface-900">
          <div className="absolute top-0 left-0 right-0 z-10 p-6 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-950/45 backdrop-blur-md text-surface-100 hover:bg-surface-950/65 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">{t('Indietro')}</span>
            </button>
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="glass" />
              <IconTile
                icon={<Home />}
                variant="glass"
                label={t('Home')}
                onClick={() => navigate('/')}
              />
            </div>
          </div>

          <div className="h-full flex items-center justify-center p-12">
            {heroImage ? (
              <img
                src={heroImage}
                alt={heroTitle}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="w-96 h-96 bg-surface-800 rounded-2xl flex items-center justify-center">
                {currentStep?.kind === 'navigation' ? (
                  <NavigationIcon className="w-24 h-24 text-brand-800" />
                ) : (
                  <Info className="w-24 h-24 text-brand-800" />
                )}
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-6">
            <ProgressDots
              total={steps.length}
              current={currentStepIndex}
              onSelect={goToStep}
              tone="onSurface"
            />
            <p className="text-surface-500 text-sm text-center mt-2">
              {format(t('Tappa {current} di {total}'), {
                current: String(currentStepIndex + 1),
                total: String(steps.length),
              })}
            </p>
          </div>
        </div>

        <div className="w-1/2 xl:w-2/5 h-full bg-surface-950 flex flex-col">
          <div className="p-6 border-b border-surface-800">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl font-bold text-surface-50 mb-2 leading-tight">
                  {heroTitle}
                </h1>
                <p className="text-sm text-surface-500">{heroSubtitle}</p>
              </div>
              <IconTile
                icon={<Settings />}
                variant="panel"
                label={t('Impostazioni')}
                onClick={() => setShowSettings(true)}
              />
            </div>

            {isSpeaking && (
              <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/25 rounded-xl">
                <div className="flex items-center gap-0.5 h-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-0.5 h-full bg-brand-400 rounded-full speaking-bar" />
                  ))}
                </div>
                <span className="text-brand-300 text-sm font-medium">
                  {t('In riproduzione...')}
                </span>
              </div>
            )}
          </div>

          {isArtwork && (
            <>
              <div className="px-6 py-4 border-b border-surface-800">
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  {t('Livello contenuto')}
                </p>
                <div className="flex gap-2">
                  {Object.values(LanguageLevel).map((level) => (
                    <button
                      key={level}
                      onClick={() => setLanguageLevel(level)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                        languageLevel === level
                          ? 'gradient-aurora text-white'
                          : 'bg-surface-900 text-surface-400 hover:bg-surface-800'
                      }`}
                    >
                      {LEVEL_META[level].emoji} {LEVEL_META[level].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="px-6 py-4 border-b border-surface-800">
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
                  {t('Durata descrizione')}
                </p>
                <div className="flex gap-2">
                  {Object.values(ContentDuration).map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setContentDuration(dur)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                        contentDuration === dur
                          ? 'gradient-aurora text-white'
                          : 'bg-surface-900 text-surface-400 hover:bg-surface-800'
                      }`}
                    >
                      {DURATION_META[dur].emoji} {DURATION_META[dur].label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-surface-300 text-base leading-relaxed">
              {currentText || t('Nessun contenuto disponibile per questa tappa.')}
            </p>
          </div>

          <div className="p-6 border-t border-surface-800 bg-surface-900">
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="p-3 rounded-xl bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handlePlay}
                disabled={!currentText}
                className="p-5 rounded-2xl gradient-aurora text-white shadow-glow-lg hover:brightness-110 transition-all disabled:opacity-40"
              >
                {isSpeaking ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
              </button>

              <button
                onClick={nextStep}
                disabled={currentStepIndex === steps.length - 1}
                className="p-3 rounded-xl bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleVoice}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-danger-500 text-surface-950 voice-active'
                    : 'bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? t('Termina') : t('Comandi vocali')}</span>
              </button>

              <button
                onClick={() => setShowItemList(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800 transition-all"
              >
                <List className="w-4 h-4" />
                <span>{t('Tutte le tappe')}</span>
              </button>

              <button
                onClick={() => setShowQuickActions(true)}
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

      {/* Lista tappe */}
      <Sheet
        open={showItemList}
        onClose={() => setShowItemList(false)}
        title={t('Tappe della visita')}
      >
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const label =
              step.kind === 'artwork'
                ? step.artwork.title
                : step.kind === 'logistic'
                  ? step.title
                  : t('Indicazioni');
            const sub =
              step.kind === 'artwork'
                ? step.artwork.author
                : step.kind === 'logistic'
                  ? t('Info pratiche')
                  : t('Come muoversi');
            return (
              <button
                key={step.id}
                onClick={() => {
                  goToStep(idx);
                  setShowItemList(false);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                  idx === currentStepIndex
                    ? 'bg-brand-500/12 border-2 border-brand-500/40'
                    : 'bg-surface-800 border-2 border-transparent hover:bg-surface-700'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    idx === currentStepIndex
                      ? 'gradient-aurora text-white'
                      : idx < currentStepIndex
                        ? 'bg-surface-700 text-surface-400'
                        : 'bg-surface-700 text-surface-500'
                  }`}
                >
                  {step.kind === 'artwork' ? (
                    idx + 1
                  ) : step.kind === 'logistic' ? (
                    <Info className="w-4 h-4" />
                  ) : (
                    <NavigationIcon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium truncate ${idx === currentStepIndex ? 'text-brand-300' : 'text-surface-100'}`}
                  >
                    {label}
                  </p>
                  {sub && <p className="text-xs text-surface-500 truncate">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </Sheet>

      {/* Servizi rapidi */}
      <Sheet
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        title={t('Servizi del museo')}
      >
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              icon: MapIcon,
              label: t('Mappa'),
              action: () => {
                setShowQuickActions(false);
                setShowMap(true);
              },
            },
            { icon: DoorOpen, label: t('Uscita') },
            { icon: MapPin, label: t('Toilette') },
            { icon: Coffee, label: t('Bar') },
            { icon: ShoppingBag, label: t('Shop') },
            { icon: Accessibility, label: t('Accessibilità') },
            { icon: HelpCircle, label: t('Info') },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-brand-300 transition-colors"
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {/* Impostazioni */}
      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title={t('Impostazioni')}>
        <div className="mb-5">
          <p className="text-sm font-medium text-surface-300 mb-2">{t('Lingua')}</p>
          <LanguageSwitcher />
        </div>

        <div className="mb-5">
          <p className="text-sm font-medium text-surface-300 mb-2">{t('Livello contenuto')}</p>
          <div className="flex gap-2">
            {Object.values(LanguageLevel).map((level) => (
              <button
                key={level}
                onClick={() => setLanguageLevel(level)}
                className={`flex-1 py-3 px-3 rounded-xl text-sm font-medium transition-all ${
                  languageLevel === level
                    ? 'gradient-aurora text-white'
                    : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                }`}
              >
                {LEVEL_META[level].emoji} {LEVEL_META[level].label}
              </button>
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
            </div>
          </div>
        </div>
      </Sheet>

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
          currentArtworkId={artworkStep?.artwork.wikidataId}
          visitArtworkIds={steps
            .filter((s): s is Extract<PlayerStep, { kind: 'artwork' }> => s.kind === 'artwork')
            .map((s) => s.artwork.wikidataId)}
          onMarkerClick={(marker) => {
            if (marker.type === 'artwork' && marker.artworkId) {
              const idx = steps.findIndex(
                (s) => s.kind === 'artwork' && s.artwork.wikidataId === marker.artworkId,
              );
              if (idx >= 0) {
                goToStep(idx);
                setShowMap(false);
              }
            }
          }}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
