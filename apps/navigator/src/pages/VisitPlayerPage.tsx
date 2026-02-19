import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Mic,
  MicOff,
  X,
  MapPin,
  Map,
  Coffee,
  ShoppingBag,
  DoorOpen,
  HelpCircle,
  Accessibility,
  Settings,
  List,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Home,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useNavigator } from '../context/NavigatorContext';
import { speechService, voiceRecognitionService, parseVoiceCommand } from '../services/speech';
import { api, ApiError } from '../services/api';
import {
  LanguageLevel,
  ContentDuration,
  MarkerType,
  VisitStepType,
  type Artwork,
  type Item,
  type MuseumMap,
} from '@artaround/shared';
import MapView from '../components/MapView';

export default function VisitPlayerPage() {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const {
    currentStep,
    currentStepIndex,
    steps,
    isSpeaking,
    isListening,
    languageLevel,
    contentDuration,
    setSteps,
    goToStep,
    nextStep,
    prevStep,
    setLanguageLevel,
    setContentDuration,
    setSpeaking,
    setListening,
    getCurrentContent,
  } = useNavigator();

  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showItemList, setShowItemList] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [museumMap, setMuseumMap] = useState<MuseumMap | null>(null);
  const [artworksLookup, setArtworksLookup] = useState<Record<string, Artwork>>({});

  // Get current artwork from step
  const currentArtwork = currentStep?.artwork;

  // Load visit and build steps from API
  useEffect(() => {
    async function loadVisitData() {
      if (!visitId) {
        setError('ID visita non valido');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get visit details
        const visit = await api.getVisit(visitId);

        if (!visit.steps || visit.steps.length === 0) {
          setError('Questa visita non contiene opere');
          setLoading(false);
          return;
        }

        // Load museum to get the map configuration
        if (visit.museumId) {
          try {
            const museum = await api.getMuseum(visit.museumId as string);
            // Use first floor's map if available
            if (museum.floors && museum.floors.length > 0) {
              const firstFloor = museum.floors[0];
              setMuseumMap({
                type: 'svg',
                svgContent: firstFloor.svgContent,
                dimensions: firstFloor.dimensions,
                markers: firstFloor.markers,
                floors: museum.floors,
              });
            }
          } catch (museumErr) {
            console.warn('Failed to load museum:', museumErr);
          }
        }

        // Load artworks and items for each step
        const artworkSteps = visit.steps.filter(
          (step) => step.type === VisitStepType.ARTWORK && step.artworkId,
        );

        // Fetch all artworks
        const artworkIds = [...new Set(artworkSteps.map((s) => s.artworkId!))];
        const artworksData = await Promise.all(
          artworkIds.map(async (artworkId) => {
            try {
              return await api.getArtwork(artworkId);
            } catch {
              console.warn(`Failed to load artwork ${artworkId}`);
              return null;
            }
          }),
        );

        // Build artworks lookup object
        const artworksById: Record<string, Artwork> = {};
        artworksData.filter(Boolean).forEach((artwork) => {
          if (artwork) {
            artworksById[artwork.wikidataId] = artwork;
            artworksById[artwork._id] = artwork;
          }
        });
        setArtworksLookup(artworksById);

        // Fetch items for each artwork
        const itemsByArtworkId: Record<string, Item[]> = {};
        await Promise.all(
          artworkIds.map(async (artworkId) => {
            try {
              const items = await api.getItemsForArtwork(artworkId);
              itemsByArtworkId[artworkId] = items;
            } catch {
              console.warn(`Failed to load items for artwork ${artworkId}`);
              itemsByArtworkId[artworkId] = [];
            }
          }),
        );

        // Build navigator steps
        type NavigatorStep = {
          artwork: Artwork;
          items: Item[];
          selectedItem: Item | null;
        };

        const navigatorSteps: NavigatorStep[] = visit.steps
          .filter((step) => step.type === VisitStepType.ARTWORK && step.artworkId)
          .sort((a, b) => a.order - b.order)
          .map((step) => {
            const artwork = artworksById[step.artworkId!];
            const artworkItems = itemsByArtworkId[step.artworkId!] || [];
            return {
              artwork: artwork!,
              items: artworkItems,
              selectedItem: artworkItems[0] || null,
            };
          })
          .filter((step) => step.artwork);

        if (navigatorSteps.length === 0) {
          setError('Impossibile caricare le opere della visita');
          setLoading(false);
          return;
        }

        setSteps(navigatorSteps);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : 'Impossibile caricare la visita. Verifica la connessione.';
        setError(message);
        console.error('Failed to load visit:', err);
      } finally {
        setLoading(false);
      }
    }

    loadVisitData();
  }, [visitId, setSteps]);

  // Speech synthesis
  const handlePlay = useCallback(() => {
    const text = getCurrentContent();
    if (!text) return;

    if (isSpeaking) {
      speechService.stop();
      setSpeaking(false);
    } else {
      speechService.onEnd(() => setSpeaking(false));
      speechService.speak(text);
      setSpeaking(true);
    }
  }, [getCurrentContent, isSpeaking, setSpeaking]);

  // Voice recognition

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
        case 'more':
          if (contentDuration === ContentDuration.SHORT) setContentDuration(ContentDuration.MEDIUM);
          else if (contentDuration === ContentDuration.MEDIUM)
            setContentDuration(ContentDuration.LONG);
          else setContentDuration(ContentDuration.EXTENDED);
          break;
        case 'less':
          if (contentDuration === ContentDuration.EXTENDED)
            setContentDuration(ContentDuration.LONG);
          else if (contentDuration === ContentDuration.LONG)
            setContentDuration(ContentDuration.MEDIUM);
          else setContentDuration(ContentDuration.SHORT);
          break;
        case 'repeat':
          speechService.stop();
          setTimeout(() => handlePlay(), 100);
          break;
        default:
          setShowQuickActions(true);
      }
    },
    [contentDuration, handlePlay, nextStep, prevStep, setContentDuration, setSpeaking],
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

  // Cleanup
  useEffect(() => {
    return () => {
      speechService.stop();
      voiceRecognitionService.stop();
    };
  }, []);

  // Keyboard navigation (desktop)
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

  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand-100 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
          </div>
          <p className="text-surface-500">Caricamento visita...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-50">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mb-2">Errore</h2>
          <p className="text-surface-500 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  // No steps state
  if (steps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-50">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-100 flex items-center justify-center">
            <Volume2 className="w-8 h-8 text-surface-400" />
          </div>
          <h2 className="text-lg font-semibold text-surface-900 mb-2">Nessuna opera</h2>
          <p className="text-surface-500 mb-4">Questa visita non contiene opere da visualizzare.</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
          >
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  const durationLabels: Record<
    ContentDuration,
    { emoji: string; label: string; shortLabel: string }
  > = {
    [ContentDuration.FLASH]: { emoji: '⚡', label: 'Flash', shortLabel: '3s' },
    [ContentDuration.SHORT]: { emoji: '📝', label: 'Breve', shortLabel: '15s' },
    [ContentDuration.MEDIUM]: { emoji: '📖', label: 'Medio', shortLabel: '1m' },
    [ContentDuration.LONG]: { emoji: '📚', label: 'Lungo', shortLabel: '4m' },
    [ContentDuration.EXTENDED]: { emoji: '🎓', label: 'Completo', shortLabel: '10m' },
  };

  const levelLabels: Record<LanguageLevel, { emoji: string; label: string }> = {
    [LanguageLevel.CHILDREN]: { emoji: '👶', label: 'Bambini' },
    [LanguageLevel.ELEMENTARY]: { emoji: '🌱', label: 'Base' },
    [LanguageLevel.MEDIUM]: { emoji: '🌿', label: 'Intermedio' },
    [LanguageLevel.SPECIALIST]: { emoji: '🌳', label: 'Esperto' },
  };

  return (
    <div className="h-full bg-surface-900 lg:bg-surface-100">
      {/* MOBILE LAYOUT */}
      <div className="lg:hidden h-full flex flex-col relative">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-20 safe-top">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowItemList(true)}
                className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Artwork image */}
        <div className="flex-1 relative" onClick={() => setShowControls(!showControls)}>
          <div className="absolute inset-0">
            {currentArtwork?.image ? (
              <img
                src={currentArtwork.image}
                alt={currentArtwork.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-surface-700 to-surface-900 flex items-center justify-center">
                <div className="text-8xl opacity-50">🎨</div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/50" />
          </div>

          {/* Progress indicator */}
          <div className="absolute top-20 left-4 right-4">
            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToStep(idx);
                  }}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    idx === currentStepIndex
                      ? 'bg-white'
                      : idx < currentStepIndex
                        ? 'bg-white/50'
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
            <p className="text-white/60 text-xs mt-2 text-center font-medium">
              {currentStepIndex + 1} di {steps.length}
            </p>
          </div>

          {/* Speaking indicator */}
          {isSpeaking && (
            <div className="absolute top-36 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 px-4 py-2 bg-brand-600 rounded-full shadow-lg">
                <div className="flex items-center gap-0.5 h-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-0.5 h-full bg-white rounded-full speaking-bar" />
                  ))}
                </div>
                <span className="text-white text-xs font-semibold">In riproduzione</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom panel */}
        <div
          className={`relative z-10 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-[calc(100%-4rem)]'}`}
        >
          {/* Artwork info overlay */}
          <div className="px-5 pb-4">
            <h1 className="text-xl font-bold text-white mb-1 drop-shadow-lg">
              {currentArtwork?.title}
            </h1>
            <p className="text-white/70 text-sm">
              {currentArtwork?.author} • {currentArtwork?.style || currentArtwork?.movement}
            </p>
          </div>

          {/* Content panel */}
          <div className="bg-white rounded-t-3xl px-5 pt-5 pb-6 safe-bottom shadow-2xl">
            {/* Duration selector */}
            <div className="flex gap-2 mb-4">
              {Object.values(ContentDuration).map((dur) => (
                <button
                  key={dur}
                  onClick={() => setContentDuration(dur)}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
                    contentDuration === dur
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {durationLabels[dur].emoji} {durationLabels[dur].label}
                </button>
              ))}
            </div>

            {/* Text content */}
            <div className="bg-surface-50 rounded-2xl p-4 mb-5 max-h-28 overflow-y-auto border border-surface-100">
              <p className="text-surface-700 text-sm leading-relaxed">{getCurrentContent()}</p>
            </div>

            {/* Main controls */}
            <div className="flex items-center justify-center gap-5 mb-4">
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="p-3.5 rounded-full bg-surface-100 text-surface-700 hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={handlePlay}
                className={`p-6 rounded-full transition-all active:scale-95 ${
                  isSpeaking
                    ? 'bg-brand-600 text-white shadow-xl shadow-brand-500/40 scale-105'
                    : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30'
                }`}
              >
                {isSpeaking ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>

              <button
                onClick={nextStep}
                disabled={currentStepIndex === steps.length - 1}
                className="p-3.5 rounded-full bg-surface-100 text-surface-700 hover:bg-surface-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* Secondary controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleVoice}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-red-500 text-white voice-active'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? 'Termina' : 'Voce'}</span>
              </button>

              <button
                onClick={() => setShowQuickActions(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 transition-all"
              >
                <MapPin className="w-4 h-4" />
                <span>Servizi</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP LAYOUT - Two column */}
      <div className="hidden lg:flex h-full">
        {/* Left side - Artwork */}
        <div className="w-1/2 xl:w-3/5 h-full relative bg-surface-900">
          {/* Back navigation */}
          <div className="absolute top-0 left-0 right-0 z-10 p-6 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Indietro</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md text-white hover:bg-black/60 transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>

          {/* Image */}
          <div className="h-full flex items-center justify-center p-12">
            {currentArtwork?.image ? (
              <img
                src={currentArtwork.image}
                alt={currentArtwork.title}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="w-96 h-96 bg-gradient-to-br from-surface-700 to-surface-800 rounded-2xl flex items-center justify-center">
                <div className="text-9xl opacity-30">🎨</div>
              </div>
            )}
          </div>

          {/* Progress at bottom */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="flex gap-2 mb-2">
              {steps.map((step, idx) => (
                <button
                  key={idx}
                  onClick={() => goToStep(idx)}
                  className={`h-1.5 flex-1 rounded-full transition-all hover:opacity-80 ${
                    idx === currentStepIndex
                      ? 'bg-white'
                      : idx < currentStepIndex
                        ? 'bg-white/50'
                        : 'bg-white/20'
                  }`}
                  title={step.artwork?.title}
                />
              ))}
            </div>
            <p className="text-white/60 text-sm text-center">
              Opera {currentStepIndex + 1} di {steps.length}
            </p>
          </div>
        </div>

        {/* Right side - Controls & Content */}
        <div className="w-1/2 xl:w-2/5 h-full bg-white flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-surface-200">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-surface-900 mb-2 leading-tight">
                  {currentArtwork?.title}
                </h1>
                <div className="flex items-center gap-3 text-sm text-surface-500">
                  <span className="font-medium text-surface-700">{currentArtwork?.author}</span>
                  <span>•</span>
                  <span>{currentArtwork?.style || currentArtwork?.movement}</span>
                </div>
              </div>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-xl bg-surface-100 text-surface-600 hover:bg-surface-200 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            {/* Speaking indicator */}
            {isSpeaking && (
              <div className="flex items-center gap-2 px-4 py-2 bg-brand-50 border border-brand-200 rounded-xl">
                <div className="flex items-center gap-0.5 h-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-0.5 h-full bg-brand-600 rounded-full speaking-bar" />
                  ))}
                </div>
                <span className="text-brand-700 text-sm font-medium">In riproduzione...</span>
              </div>
            )}
          </div>

          {/* Level selector */}
          <div className="px-6 py-4 border-b border-surface-100">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Livello contenuto
            </p>
            <div className="flex gap-2">
              {Object.values(LanguageLevel).map((level) => (
                <button
                  key={level}
                  onClick={() => setLanguageLevel(level)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    languageLevel === level
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {levelLabels[level].emoji} {levelLabels[level].label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration selector */}
          <div className="px-6 py-4 border-b border-surface-100">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">
              Durata descrizione
            </p>
            <div className="flex gap-2">
              {Object.values(ContentDuration).map((dur) => (
                <button
                  key={dur}
                  onClick={() => setContentDuration(dur)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    contentDuration === dur
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {durationLabels[dur].emoji} {durationLabels[dur].label}
                </button>
              ))}
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-surface-700 text-base leading-relaxed">{getCurrentContent()}</p>
          </div>

          {/* Controls */}
          <div className="p-6 border-t border-surface-200 bg-surface-50">
            {/* Main playback controls */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={prevStep}
                disabled={currentStepIndex === 0}
                className="p-3 rounded-xl bg-white border border-surface-200 text-surface-700 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={handlePlay}
                className={`p-5 rounded-2xl transition-all ${
                  isSpeaking
                    ? 'bg-brand-600 text-white shadow-xl shadow-brand-500/40 scale-105'
                    : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/30'
                }`}
              >
                {isSpeaking ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-0.5" />}
              </button>

              <button
                onClick={nextStep}
                disabled={currentStepIndex === steps.length - 1}
                className="p-3 rounded-xl bg-white border border-surface-200 text-surface-700 hover:bg-surface-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Secondary actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleVoice}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-red-500 text-white voice-active'
                    : 'bg-white border border-surface-200 text-surface-600 hover:bg-surface-100 shadow-sm'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? 'Termina' : 'Comandi vocali'}</span>
              </button>

              <button
                onClick={() => setShowItemList(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-surface-200 text-surface-600 hover:bg-surface-100 shadow-sm transition-all"
              >
                <List className="w-4 h-4" />
                <span>Lista opere</span>
              </button>

              <button
                onClick={() => setShowQuickActions(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white border border-surface-200 text-surface-600 hover:bg-surface-100 shadow-sm transition-all"
              >
                <MapPin className="w-4 h-4" />
                <span>Servizi</span>
              </button>
            </div>

            {/* Keyboard hint */}
            <p className="text-xs text-surface-400 text-center mt-4">
              Usa le frecce ← → per navigare, Spazio per play/pausa
            </p>
          </div>
        </div>
      </div>

      {/* MODALS */}

      {/* Item List Modal */}
      {showItemList && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowItemList(false)}
        >
          <div
            className="absolute inset-x-4 lg:inset-x-auto lg:right-8 lg:w-96 top-1/2 lg:top-8 lg:bottom-8 -translate-y-1/2 lg:translate-y-0 bg-white rounded-2xl overflow-hidden animate-slide-up shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-surface-200">
              <h2 className="font-semibold text-surface-900">Opere della visita</h2>
              <button
                onClick={() => setShowItemList(false)}
                className="p-2 rounded-full hover:bg-surface-100"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {steps.map((step, idx) => (
                <button
                  key={step.artwork?._id || idx}
                  onClick={() => {
                    goToStep(idx);
                    setShowItemList(false);
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all ${
                    idx === currentStepIndex
                      ? 'bg-brand-50 border-2 border-brand-300'
                      : 'bg-surface-50 border-2 border-transparent hover:bg-surface-100'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      idx === currentStepIndex
                        ? 'bg-brand-600 text-white'
                        : idx < currentStepIndex
                          ? 'bg-surface-300 text-surface-600'
                          : 'bg-surface-200 text-surface-500'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium truncate ${idx === currentStepIndex ? 'text-brand-700' : 'text-surface-800'}`}
                    >
                      {step.artwork?.title}
                    </p>
                    <p className="text-xs text-surface-500 truncate">{step.artwork?.author}</p>
                  </div>
                  {idx === currentStepIndex && isSpeaking && (
                    <div className="flex items-center gap-0.5 h-4">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="w-0.5 h-full bg-brand-500 rounded-full speaking-bar"
                        />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Modal */}
      {showQuickActions && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowQuickActions(false)}
        >
          <div
            className="absolute bottom-0 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-96 bg-white rounded-t-2xl lg:rounded-2xl animate-slide-up safe-bottom shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2 lg:hidden">
              <div className="w-10 h-1 bg-surface-300 rounded-full" />
            </div>
            <div className="hidden lg:flex items-center justify-between p-4 border-b border-surface-200">
              <h2 className="font-semibold text-surface-900">Servizi del museo</h2>
              <button
                onClick={() => setShowQuickActions(false)}
                className="p-2 rounded-full hover:bg-surface-100"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            <div className="px-5 pb-6 lg:p-6">
              <h2 className="font-semibold text-surface-900 mb-4 lg:hidden">Servizi del museo</h2>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: Map,
                    label: 'Mappa',
                    color: 'text-brand-600 bg-brand-50 hover:bg-brand-100',
                    action: () => {
                      setShowQuickActions(false);
                      setShowMap(true);
                    },
                  },
                  {
                    icon: DoorOpen,
                    label: 'Uscita',
                    color: 'text-green-600 bg-green-50 hover:bg-green-100',
                  },
                  {
                    icon: MapPin,
                    label: 'Toilette',
                    color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
                  },
                  {
                    icon: Coffee,
                    label: 'Bar',
                    color: 'text-amber-600 bg-amber-50 hover:bg-amber-100',
                  },
                  {
                    icon: ShoppingBag,
                    label: 'Shop',
                    color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
                  },
                  {
                    icon: Accessibility,
                    label: 'Accessibilità',
                    color: 'text-brand-600 bg-brand-50 hover:bg-brand-100',
                  },
                  {
                    icon: HelpCircle,
                    label: 'Info',
                    color: 'text-surface-600 bg-surface-100 hover:bg-surface-200',
                  },
                ].map(({ icon: Icon, label, color, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`flex flex-col items-center gap-2.5 p-4 rounded-xl transition-colors ${color}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="absolute bottom-0 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 left-0 right-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-[480px] bg-white rounded-t-2xl lg:rounded-2xl animate-slide-up safe-bottom shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2 lg:hidden">
              <div className="w-10 h-1 bg-surface-300 rounded-full" />
            </div>
            <div className="hidden lg:flex items-center justify-between p-4 border-b border-surface-200">
              <h2 className="font-semibold text-surface-900">Impostazioni</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 rounded-full hover:bg-surface-100"
              >
                <X className="w-5 h-5 text-surface-500" />
              </button>
            </div>
            <div className="px-5 pb-6 lg:p-6">
              <h2 className="font-semibold text-surface-900 mb-4 lg:hidden">Impostazioni</h2>

              {/* Content level */}
              <div className="mb-5">
                <p className="text-sm font-medium text-surface-700 mb-2">Livello contenuto</p>
                <div className="flex gap-2">
                  {Object.values(LanguageLevel).map((level) => (
                    <button
                      key={level}
                      onClick={() => setLanguageLevel(level)}
                      className={`flex-1 py-3 px-3 rounded-xl text-sm font-medium transition-all ${
                        languageLevel === level
                          ? 'bg-brand-600 text-white shadow-md'
                          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}
                    >
                      {levelLabels[level].emoji} {levelLabels[level].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Voice commands help */}
              <div>
                <p className="text-sm font-medium text-surface-700 mb-2">
                  Comandi vocali disponibili
                </p>
                <div className="bg-surface-50 rounded-xl p-4 text-sm text-surface-600 space-y-2 border border-surface-100">
                  <div className="grid grid-cols-2 gap-2">
                    <p>
                      <span className="font-semibold text-surface-800">"Prossimo"</span> — Avanti
                    </p>
                    <p>
                      <span className="font-semibold text-surface-800">"Precedente"</span> —
                      Indietro
                    </p>
                    <p>
                      <span className="font-semibold text-surface-800">"Leggi"</span> — Avvia audio
                    </p>
                    <p>
                      <span className="font-semibold text-surface-800">"Stop"</span> — Ferma audio
                    </p>
                    <p>
                      <span className="font-semibold text-surface-800">"Dimmi di più"</span> — Più
                      lungo
                    </p>
                    <p>
                      <span className="font-semibold text-surface-800">"Dimmi di meno"</span> — Più
                      breve
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map View */}
      {showMap && (
        <MapView
          map={
            museumMap
              ? {
                  ...museumMap,
                  // Ensure markers have labels from artworks
                  markers:
                    museumMap.markers?.map((marker) => {
                      if (marker.type === MarkerType.ARTWORK && marker.artworkId) {
                        const artwork = artworksLookup[marker.artworkId];
                        return { ...marker, label: artwork?.title || marker.label };
                      }
                      return marker;
                    }) || [],
                }
              : {
                  type: 'image',
                  imageUrl: '/placeholder-map.png',
                  dimensions: { width: 800, height: 600 },
                  markers: steps.map((step, index) => ({
                    id: step.artwork?._id || `step-${index}`,
                    x: 100 + (index % 4) * 150,
                    y: 100 + Math.floor(index / 4) * 150,
                    type: MarkerType.ARTWORK,
                    label: step.artwork?.title || '',
                    artworkId: step.artwork?.wikidataId || step.artwork?._id,
                  })),
                }
          }
          currentArtworkId={currentArtwork?.wikidataId || currentArtwork?._id}
          visitArtworkIds={steps.map((step) => step.artwork?.wikidataId || step.artwork?._id || '')}
          onMarkerClick={(marker) => {
            if (marker.type === 'artwork' && marker.artworkId) {
              const idx = steps.findIndex(
                (step) =>
                  step.artwork?.wikidataId === marker.artworkId ||
                  step.artwork?._id === marker.artworkId,
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
