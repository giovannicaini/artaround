import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
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
  Settings,
  List,
  ChevronLeft,
  ChevronRight,
  Info,
  Navigation as NavigationIcon,
  Home,
  Maximize2,
  X,
  BookOpen,
  MoreVertical,
} from 'lucide-react';
import { api, ApiError } from '../services/apiClient';
import { useAuthStore } from '../context/authStore';
import { useI18nStore } from '../context/i18nStore';
import { useT } from '../services/useT';
import { useVisitSessionStore, type PlayerStep } from '../context/visitSessionStore';
import { speechService, voiceRecognitionService, parseVoiceCommand } from '../services/speech';
import { audioPlaybackService } from '../services/audioPlayback';
import {
  getStepText,
  getStepAudio,
  getStepTitle,
  pickItemForPreferences,
  localizedItemText,
} from '../services/content';
import { format, localizedField, toSpeechLocale } from '../services/i18n';
import { defaultLanguageLevel, defaultContentDuration } from '../services/personalization';
import { saveVisitProgress } from '../services/visitProgress';
import {
  LanguageLevel,
  ContentDuration,
  VisitStepType,
  MarkerType,
  getReferenceTypeLabel,
  MARKER_TYPE_META,
  type Item,
  type MuseumMap,
  type Visit,
  type Artwork,
  type AppLanguage,
  type GeneratedAudio,
  type MuseumService,
} from '@artaround/shared';
import {
  IconTile,
  Sheet,
  Chip,
  ProgressDots,
  LoadingState,
  ErrorState,
  LanguageSwitcher,
  HighlightedText,
  PurchasePrompt,
} from '../components/ui';
import MapView from '../components/MapView';
import { ServiceDetailSheet } from '../components/ServiceDetailSheet';
import { buildVisitRoutePoints, buildMuseumMap, type RoutePoint } from '../services/mapRoute';

// Fade + scivolamento nel verso di navigazione tra una tappa e l'altra ("custom" = 1 avanti, -1 indietro).
const stepImageVariants = {
  enter: { opacity: 0, scale: 0.97 },
  center: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
};
const stepTextVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 18 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: -dir * 18 }),
};
const stepTransition = { duration: 0.22, ease: 'easeOut' as const };

// Titoli lunghi su più righe: riduce il font invece di lasciarlo fisso.
function titleFontSizeClass(title: string): string {
  if (title.length > 44) return 'text-base';
  if (title.length > 28) return 'text-lg';
  return 'text-xl';
}

// Stessa priorità di heroImage (più sotto), per il prefetch delle tappe adiacenti.
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

async function loadVisitData(visitId: string): Promise<{
  visit: Visit;
  steps: PlayerStep[];
  museumMap: MuseumMap | null;
  routePoints: RoutePoint[];
  artworkInfo: Record<string, { title: string; image: string }>;
  // Solo le lingue per cui il curatore ha davvero generato le traduzioni.
  activeLanguages: AppLanguage[] | undefined;
  // Solo i servizi che il curatore ha attivato per questo museo.
  activeServices: MuseumService[];
}> {
  const visit = await api.getVisit(visitId);
  if (!visit.steps || visit.steps.length === 0) {
    throw new Error('Questa visita non contiene tappe.');
  }

  let museumMap: MuseumMap | null = null;
  let routePoints: RoutePoint[] = [];
  let activeLanguages: AppLanguage[] | undefined;
  let activeServices: MuseumService[] = [];
  // museumId della visita può essere il QID o l'_id Mongo — gli Item usano sempre il QID.
  let museumWikidataId: string | undefined;
  if (visit.museumId) {
    try {
      const museum = await api.getMuseum(visit.museumId as string);
      activeLanguages = museum.activeLanguages;
      activeServices = (museum.services?.services || []).filter((service) => service.active);
      museumWikidataId = museum.wikidataId;
      museumMap = buildMuseumMap(museum);
      if (museumMap) {
        routePoints = buildVisitRoutePoints(visit.steps, museum.floors || []);
      }
    } catch {
      // La mappa è un'aggiunta, non un requisito: la visita resta fruibile senza.
    }
  }

  // Solo gli item scelti dal curatore, o tutti se non ne ha scelto nessuno esplicitamente.
  const filterByItemIds = (items: Item[], itemIds?: string[]): Item[] =>
    itemIds && itemIds.length > 0 ? items.filter((item) => itemIds.includes(item._id)) : items;

  const orderedSteps = [...visit.steps]
    .filter((step) => step.type !== VisitStepType.WAYPOINT)
    .sort((a, b) => a.order - b.order);

  const artworkStepDefs = orderedSteps.filter(
    (step) => step.type === VisitStepType.ARTWORK && step.artworkId,
  );
  const artworkIds = [...new Set(artworkStepDefs.map((s) => s.artworkId!))];

  const contentStepDefs = orderedSteps.filter(
    (step) => step.type === VisitStepType.CONTENT && step.contentReferenceType,
  );
  const contentReferenceTypes = [...new Set(contentStepDefs.map((s) => s.contentReferenceType!))];

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
  const artworkInfo: Record<string, { title: string; image: string }> = {};
  artworks.forEach((artwork) => {
    if (artwork) {
      artworksById[artwork.wikidataId] = artwork;
      artworksById[artwork._id] = artwork;
      artworkInfo[artwork.wikidataId] = { title: artwork.title, image: artwork.image };
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

  // Item per tappa CONTENT, per tipo di riferimento (non per artworkId: non
  // sono legati a un'opera specifica) — vedi PlayerStep 'content'.
  const itemsByReferenceType: Record<string, Item[]> = {};
  if (museumWikidataId) {
    await Promise.all(
      contentReferenceTypes.map(async (referenceType) => {
        try {
          itemsByReferenceType[referenceType] = await api.getItemsByReferenceType(
            referenceType,
            museumWikidataId as string,
          );
        } catch {
          itemsByReferenceType[referenceType] = [];
        }
      }),
    );
  }

  // Contenuto su autore/movimento delle opere, per rispondere alle domande vocali "chi è l'autore".
  const resolvedArtworks = Object.values(artworksById);
  const authorWikidataIds = [
    ...new Set(resolvedArtworks.map((a) => a.authorWikidataId).filter((id): id is string => !!id)),
  ];
  const movementWikidataIds = [
    ...new Set(
      resolvedArtworks.map((a) => a.movementWikidataId).filter((id): id is string => !!id),
    ),
  ];
  const itemsByAuthorId: Record<string, Item[]> = {};
  const itemsByMovementId: Record<string, Item[]> = {};
  await Promise.all([
    ...authorWikidataIds.map(async (id) => {
      try {
        itemsByAuthorId[id] = await api.getItems({ referenceType: 'author', referenceId: id });
      } catch {
        itemsByAuthorId[id] = [];
      }
    }),
    ...movementWikidataIds.map(async (id) => {
      try {
        itemsByMovementId[id] = await api.getItems({ referenceType: 'movement', referenceId: id });
      } catch {
        itemsByMovementId[id] = [];
      }
    }),
  ]);

  const steps: PlayerStep[] = orderedSteps
    .map((step): PlayerStep | null => {
      if (step.type === VisitStepType.ARTWORK && step.artworkId) {
        const artwork = artworksById[step.artworkId];
        if (!artwork) return null;
        return {
          kind: 'artwork',
          id: step.id,
          artwork,
          items: filterByItemIds(itemsByArtworkId[step.artworkId] || [], step.itemIds),
          authorItems: artwork.authorWikidataId
            ? itemsByAuthorId[artwork.authorWikidataId]
            : undefined,
          movementItems: artwork.movementWikidataId
            ? itemsByMovementId[artwork.movementWikidataId]
            : undefined,
        };
      }
      if (step.type === VisitStepType.CONTENT && step.contentReferenceType) {
        const items = filterByItemIds(
          itemsByReferenceType[step.contentReferenceType] || [],
          step.itemIds,
        );
        if (items.length === 0) return null;
        return {
          kind: 'content',
          id: step.id,
          referenceType: step.contentReferenceType,
          items,
          mapMarkerId: step.mapMarkerId,
        };
      }
      if (step.type === VisitStepType.LOGISTIC) {
        return {
          kind: 'logistic',
          id: step.id,
          title: step.logisticTitle || 'Informazioni utili',
          titleTranslations: step.logisticTitleTranslations,
          text: step.logisticText || '',
          textTranslations: step.logisticTextTranslations,
          textAudio: step.logisticTextAudio,
          icon: step.logisticIcon,
          mapMarkerId: step.mapMarkerId,
        };
      }
      if (step.type === VisitStepType.NAVIGATION) {
        return {
          kind: 'navigation',
          id: step.id,
          text: step.navigationText || '',
          textTranslations: step.navigationTextTranslations,
          textAudio: step.navigationTextAudio,
          image: step.navigationImage,
          visual: step.navigationVisual,
          mapMarkerId: step.mapMarkerId,
        };
      }
      return null;
    })
    .filter((s): s is PlayerStep => s !== null);

  if (steps.length === 0) {
    throw new Error('Impossibile caricare le tappe di questa visita.');
  }

  return { visit, steps, museumMap, routePoints, artworkInfo, activeLanguages, activeServices };
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

  const DURATION_META: Record<ContentDuration, { emoji: string; label: string }> = {
    [ContentDuration.FLASH]: { emoji: '⚡', label: t('Flash') },
    [ContentDuration.SHORT]: { emoji: '📝', label: t('Breve') },
    [ContentDuration.MEDIUM]: { emoji: '📖', label: t('Medio') },
    [ContentDuration.LONG]: { emoji: '📚', label: t('Lungo') },
    [ContentDuration.EXTENDED]: { emoji: '🎓', label: t('Completo') },
  };
  // EXTENDED esiste nel tipo ma non viene mai generato — selezionabile risulterebbe sempre vuoto.
  const DURATION_ORDER: ContentDuration[] = Object.values(ContentDuration).filter(
    (d) => d !== ContentDuration.EXTENDED,
  );

  const LEVEL_META: Record<LanguageLevel, { emoji: string; label: string }> = {
    [LanguageLevel.CHILDREN]: { emoji: '👶', label: t('Bambini') },
    [LanguageLevel.ELEMENTARY]: { emoji: '🌱', label: t('Base') },
    [LanguageLevel.MEDIUM]: { emoji: '🌿', label: t('Intermedio') },
    [LanguageLevel.SPECIALIST]: { emoji: '🌳', label: t('Esperto') },
  };
  const LEVEL_ORDER = Object.values(LanguageLevel);

  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  // Scheda di dettaglio di un servizio del museo (bar, bagni...), aperta dalla lista Servizi o a voce.
  const [selectedService, setSelectedService] = useState<MuseumService | null>(null);
  const [showItemList, setShowItemList] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showMap, setShowMap] = useState(false);
  // Marker della mappa associato alla tappa corrente, se il curatore ne ha scelto uno.
  const [mapFocusMarkerId, setMapFocusMarkerId] = useState<string | undefined>();
  const [showFullscreenText, setShowFullscreenText] = useState(false);
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  // Fin dove è arrivata la lettura vocale (charIndex) — alimenta l'evidenziazione "karaoke".
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

  // Una volta caricata, entra nello store di sessione con i default proposti dall'utente.
  useEffect(() => {
    if (!data) return;
    start(data.visit, data.steps, {
      languageLevel: defaultLanguageLevel(user?.preferences),
      contentDuration: defaultContentDuration(user?.preferences),
    });
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
  // undefined se il curatore non ha ancora generato l'audio per questa lingua — non un errore,
  // significa solo "usa la sintesi vocale del browser" (vedi speak/handlePlay sotto).
  const currentAudio = currentStep
    ? getStepAudio(currentStep, languageLevel, contentDuration, language)
    : undefined;

  // Url dell'audio lasciato in pausa da handlePlay, per capire se riprendere da lì o ripartire.
  const pausedAudioUrlRef = useRef<string | null>(null);

  // Ferma qualunque backend stia suonando, senza toccare lo stato React (usato anche da 'repeat').
  const stopBackends = useCallback(() => {
    speechService.stop();
    audioPlaybackService.stop();
    pausedAudioUrlRef.current = null;
  }, []);

  // Ferma la lettura e riporta i controlli a "non in riproduzione", quale che sia il backend attivo.
  const stopPlayback = useCallback(() => {
    stopBackends();
    setSpeaking(false);
    setSpokenCharIndex(0);
  }, [stopBackends, setSpeaking]);

  // Legge un testo: usa l'audio generato se c'è, altrimenti la sintesi vocale del browser.
  // `source` dice quale testo a schermo evidenziare (tappa corrente o scheda approfondimento).
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

  // Apre la mappa, opzionalmente centrata su un marker — senza argomento è la mappa generale.
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
          stopPlayback();
          break;
        case 'whatIsThis':
          if (currentStep?.kind === 'artwork') {
            const { title, author } = currentStep.artwork;
            speak(
              author ? format(t('{title}, di {author}.'), { title, author }) : title,
              undefined,
              'aside',
            );
          } else if (currentText) {
            speak(currentText);
          }
          break;
        case 'more':
          speak(t('Ti racconto qualcosa in più.'), undefined, 'aside');
          shiftDuration(1);
          break;
        case 'less':
          speak(t('Va bene, riassumo.'), undefined, 'aside');
          shiftDuration(-1);
          break;
        case 'tooHard':
          speak(t('Va bene, semplifico.'), undefined, 'aside');
          shiftLevel(-1);
          break;
        case 'tooSimple':
          speak(t('Alzo un po’ il livello.'), undefined, 'aside');
          shiftLevel(1);
          break;
        case 'author':
          if (currentStep?.kind === 'artwork') {
            const authorItem = pickItemForPreferences(
              currentStep.authorItems || [],
              languageLevel,
              contentDuration,
            );
            if (authorItem) {
              setInsightType('author');
              speak(
                localizedItemText(authorItem, language),
                authorItem.audio?.[language],
                'insight',
              );
            } else {
              speak(
                currentStep.artwork.author
                  ? format(t("L'autore è {author}."), { author: currentStep.artwork.author })
                  : t("Non ho informazioni sull'autore di quest'opera."),
                undefined,
                'aside',
              );
            }
          }
          break;
        case 'style': {
          if (currentStep?.kind === 'artwork') {
            const movementItem = pickItemForPreferences(
              currentStep.movementItems || [],
              languageLevel,
              contentDuration,
            );
            if (movementItem) {
              setInsightType('movement');
              speak(
                localizedItemText(movementItem, language),
                movementItem.audio?.[language],
                'insight',
              );
            } else {
              const style = currentStep.artwork.style || currentStep.artwork.movement;
              speak(
                style
                  ? format(t('Lo stile è {style}.'), { style })
                  : t("Non ho informazioni sullo stile di quest'opera."),
                undefined,
                'aside',
              );
            }
          }
          break;
        }
        case 'repeat':
          stopBackends();
          setTimeout(() => handlePlay(), 100);
          break;
        case 'exit':
        case 'toilette':
        case 'bar':
        case 'shop': {
          const typesToTry: MarkerType[] =
            command === 'exit'
              ? [MarkerType.EXIT]
              : command === 'toilette'
                ? [MarkerType.TOILETTE, MarkerType.ACCESSIBLE_TOILETTE]
                : command === 'bar'
                  ? [MarkerType.BAR, MarkerType.RESTAURANT]
                  : [MarkerType.SHOP];
          const service = (data?.activeServices || []).find((s) => typesToTry.includes(s.type));
          if (service) {
            setSelectedService(service);
            if (service.description) {
              speak(
                localizedField(language, service.description, service.descriptionTranslations),
                undefined,
                'aside',
              );
            }
          }
          break;
        }
        case 'obstacles':
          speak(
            t('Puoi trovare tutte le indicazioni e i punti di interesse nella mappa.'),
            undefined,
            'aside',
          );
          break;
        case 'help':
          setShowSettings(true);
          break;
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
      stopBackends,
      stopPlayback,
      shiftDuration,
      shiftLevel,
      speak,
      t,
      languageLevel,
      contentDuration,
      language,
      data?.activeServices,
    ],
  );

  const [isClassifyingVoice, setClassifyingVoice] = useState(false);

  const handleVoice = useCallback(() => {
    if (isListening) {
      voiceRecognitionService.stop();
      setListening(false);
    } else {
      setListening(true);
      voiceRecognitionService.start(
        (text) => {
          setListening(false);
          const command = parseVoiceCommand(text);
          if (command) {
            handleVoiceCommand(command);
            return;
          }
          setClassifyingVoice(true);
          const sorry = t(
            'Scusa, ma non ho capito o non so come aiutarti con quello che mi hai chiesto.',
          );
          api
            .classifyVoiceCommand(text, language)
            .then((aiCommand) => {
              if (aiCommand) {
                handleVoiceCommand(aiCommand);
              } else {
                speak(sorry, undefined, 'aside');
              }
            })
            .catch(() => speak(sorry, undefined, 'aside'))
            .finally(() => setClassifyingVoice(false));
        },
        () => setListening(false),
      );
    }
  }, [isListening, setListening, handleVoiceCommand, language, speak, t]);

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

  // Visita a pagamento non posseduta: stesso invito all'acquisto della lista, non l'errore generico.
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
            {/* Un solo pulsante invece di quattro sopra l'immagine — le
                singole azioni sono nello Sheet "Menu" qui sotto. */}
            <IconTile
              icon={<MoreVertical />}
              variant="glass"
              label={t('Menu')}
              onClick={() => setShowMenu(true)}
            />
          </div>
        </header>

        {/* Altezza fissa (non un fratello flex del pannello testo sotto):
            resta identica tappa per tappa, non "salta" in base a quanto
            testo c'è sotto. object-contain invece di object-cover — un'opera
            molto orizzontale non viene ritagliata quasi per intero — con
            uno sfondo sfocato della stessa immagine dietro, per non lasciare
            barre vuote ai lati. */}
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
                    onClick={() => setShowFullscreenImage(true)}
                    className="relative w-full h-full object-contain cursor-pointer"
                  />
                </>
              ) : showMapVisual ? (
                <button
                  type="button"
                  onClick={() => openMap(stepMapMarkerId)}
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

          {/* Sfuma verso il pannello sottostante invece di tagliare di netto
              — stesso colore del pannello (surface-900), non dello sfondo
              pagina, così la dissolvenza continua nella scheda che lo
              sovrappone leggermente (-mt-6 più sotto). */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface-900 to-transparent pointer-events-none" />

          {heroImage && (
            <IconTile
              icon={<Maximize2 />}
              variant="glass"
              size="sm"
              label={t('Immagine a schermo intero')}
              onClick={() => setShowFullscreenImage(true)}
              className="absolute bottom-8 right-3"
            />
          )}

          {isSpeaking && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2">
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

        {/* Scheda sempre visibile (non più un pannello che scorre sopra
            l'immagine) — il testo non sta mai su una foto, resta leggibile
            qualunque sia l'opera. -mt-6 la sovrappone solo alla dissolvenza
            sopra, mai al testo. */}
        <div className="relative z-10 -mt-6 flex-1 min-h-0 flex flex-col bg-surface-900 rounded-t-3xl shadow-2xl overflow-hidden">
          {/* flex-col, non scrollabile nel suo insieme: se il titolo va su
              due righe non deve comparire una barra di scorrimento — a
              cedere spazio è solo il riquadro del testo qui sotto
              (flex-1 min-h-0), tutto il resto ha una dimensione fissa. */}
          <div className="flex-1 min-h-0 flex flex-col px-5 pt-6 pb-[calc(1.5rem_+_var(--safe-area-inset-bottom))]">
            <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
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

            <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
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
                {currentText ? (
                  <HighlightedText
                    text={currentText}
                    highlightUpTo={spokenSource === 'step' ? spokenCharIndex : 0}
                    className="text-surface-300 text-sm leading-relaxed"
                  />
                ) : (
                  <p className="text-surface-300 text-sm leading-relaxed">
                    {t('Nessun contenuto disponibile per questa tappa.')}
                  </p>
                )}
                {currentText && (
                  <IconTile
                    icon={<Maximize2 />}
                    variant="panel"
                    size="sm"
                    label={t('Testo a schermo intero')}
                    onClick={() => setShowFullscreenText(true)}
                    className="absolute top-2 right-2"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* mt-auto: sempre ancorato in fondo al pannello (altezza
                fissa) — un titolo su 1 o 2 righe non lo sposta mai, a
                cambiare è solo lo spazio libero sopra (assorbito dal
                riquadro del testo, con margine residuo qui). */}
            <div className="mt-auto flex-shrink-0">
              {stepMapMarkerId && !showMapVisual && (
                <button
                  onClick={() => openMap(stepMapMarkerId)}
                  className="flex items-center gap-1.5 mb-4 px-3 py-1.5 rounded-full bg-surface-800 text-brand-300 text-xs font-medium hover:bg-surface-700 transition-colors"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  {t('Vedi sulla mappa')}
                </button>
              )}

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

              <div className="mb-4">
                <ProgressDots
                  total={steps.length}
                  current={currentStepIndex}
                  onSelect={goToStep}
                  tone="onSurface"
                />
                <p className="text-surface-400 text-xs mt-1.5 text-center font-medium">
                  {format(t('{current} di {total}'), {
                    current: String(currentStepIndex + 1),
                    total: String(steps.length),
                  })}
                </p>
              </div>

              {/* Servizi è nel menu ⋮ (in header) — qui solo le tre azioni
                  usate più spesso durante la visita. */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleVoice}
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
                  onClick={() => setShowItemList(true)}
                  className="flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-full text-xs font-medium bg-surface-800 text-surface-300 hover:bg-surface-700 transition-all"
                >
                  <List className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{t('Tappe')}</span>
                </button>

                <button
                  onClick={() => openMap()}
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
              <LanguageSwitcher languages={data?.activeLanguages} variant="glass" />
              <IconTile
                icon={<Home />}
                variant="glass"
                label={t('Home')}
                onClick={() => navigate('/')}
              />
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
                // opacity-0 fino a onLoad: nasconde lo scatto mentre il riquadro assume le dimensioni reali.
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
                  onClick={() => openMap(stepMapMarkerId)}
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
              <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
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
                    onClick={() => setInsightType(hasAuthorInsight ? 'author' : 'movement')}
                  />
                )}
                <IconTile
                  icon={<Settings />}
                  variant="panel"
                  label={t('Impostazioni')}
                  onClick={() => setShowSettings(true)}
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
                <span className="text-brand-300 text-sm font-medium">
                  {t('In riproduzione...')}
                </span>
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
                  onClick={() => setShowFullscreenText(true)}
                />
              </div>
            )}
            <AnimatePresence mode="wait" custom={stepDirection} initial={false}>
              <motion.div
                key={currentStep?.id}
                custom={stepDirection}
                variants={stepTextVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={stepTransition}
              >
                {currentText ? (
                  <HighlightedText
                    text={currentText}
                    highlightUpTo={spokenSource === 'step' ? spokenCharIndex : 0}
                    className="text-surface-300 text-base leading-relaxed"
                  />
                ) : (
                  <p className="text-surface-300 text-base leading-relaxed">
                    {t('Nessun contenuto disponibile per questa tappa.')}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>

            {stepMapMarkerId && !showMapVisual && (
              <button
                onClick={() => openMap(stepMapMarkerId)}
                className="flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-brand-300 text-xs font-medium hover:bg-surface-800 transition-colors"
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t('Vedi sulla mappa')}
              </button>
            )}
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

      {/* Menu mobile: le azioni prima sparse in header sopra l'immagine
          (lingua è già dentro Impostazioni, non ripetuta qui). */}
      <Sheet open={showMenu} onClose={() => setShowMenu(false)} title={t('Menu')}>
        <div className="space-y-2">
          {(hasAuthorInsight || hasMovementInsight) && (
            <button
              onClick={() => {
                setShowMenu(false);
                setInsightType(hasAuthorInsight ? 'author' : 'movement');
              }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
            >
              <Info className="w-5 h-5 text-brand-300" />
              <span className="font-medium">{t('Approfondimento')}</span>
            </button>
          )}
          <button
            onClick={() => {
              setShowMenu(false);
              setShowQuickActions(true);
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
          >
            <MapPin className="w-5 h-5 text-brand-300" />
            <span className="font-medium">{t('Servizi')}</span>
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              setShowSettings(true);
            }}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-100 transition-colors"
          >
            <Settings className="w-5 h-5 text-brand-300" />
            <span className="font-medium">{t('Impostazioni')}</span>
          </button>
        </div>
      </Sheet>

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
                : step.kind === 'content'
                  ? pickItemForPreferences(step.items, languageLevel, contentDuration)?.title ||
                    getReferenceTypeLabel(step.referenceType)
                  : step.kind === 'logistic'
                    ? step.title
                    : t('Indicazioni');
            const sub =
              step.kind === 'artwork'
                ? step.artwork.author
                : step.kind === 'content'
                  ? getReferenceTypeLabel(step.referenceType)
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
                    ? 'bg-brand-500/[.12] border-2 border-brand-500/40'
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
                  ) : step.kind === 'content' ? (
                    <BookOpen className="w-4 h-4" />
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

      {/* Servizi rapidi — solo quelli attivati dal curatore per questo museo. */}
      <Sheet
        open={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        title={t('Servizi del museo')}
      >
        {data?.activeServices && data.activeServices.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {data.activeServices.map((service) => (
              <button
                key={service.type}
                onClick={() => {
                  setShowQuickActions(false);
                  setSelectedService(service);
                }}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-surface-800 text-surface-300 hover:bg-surface-700 hover:text-brand-300 transition-colors"
              >
                <span className="text-2xl">{MARKER_TYPE_META[service.type].icon}</span>
                <span className="text-xs font-medium">{MARKER_TYPE_META[service.type].label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-surface-400">
            {t('Nessun servizio segnalato per questo museo.')}
          </p>
        )}
      </Sheet>

      <ServiceDetailSheet
        service={selectedService}
        onClose={() => setSelectedService(null)}
        onViewOnMap={(markerId) => openMap(markerId)}
      />

      {/* Impostazioni */}
      <Sheet open={showSettings} onClose={() => setShowSettings(false)} title={t('Impostazioni')}>
        <div className="mb-5">
          <p className="text-sm font-medium text-surface-300 mb-2">{t('Lingua')}</p>
          <LanguageSwitcher languages={data?.activeLanguages} />
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

      {/* Approfondimento autore/movimento — apribile a voce ("chi è
          l'autore"/"che stile è", vedi handleVoiceCommand) o dal pulsante
          info sulla scheda opera, vedi hasAuthorInsight/hasMovementInsight. */}
      <Sheet
        open={insightType !== null}
        onClose={() => {
          if (spokenSource === 'insight') stopPlayback();
          setInsightType(null);
        }}
        title={
          insightItem?.referenceTitle || (insightType === 'author' ? t('Autore') : t('Movimento'))
        }
      >
        {hasAuthorInsight && hasMovementInsight && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                stopPlayback();
                setInsightType('author');
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                insightType === 'author'
                  ? 'gradient-aurora text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
              }`}
            >
              {t('Autore')}
            </button>
            <button
              onClick={() => {
                stopPlayback();
                setInsightType('movement');
              }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                insightType === 'movement'
                  ? 'gradient-aurora text-white'
                  : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
              }`}
            >
              {t('Movimento')}
            </button>
          </div>
        )}

        {insightText ? (
          <>
            <div className="bg-surface-950 rounded-2xl p-4 mb-4 max-h-56 overflow-y-auto border border-surface-800">
              <HighlightedText
                text={insightText}
                highlightUpTo={spokenSource === 'insight' ? spokenCharIndex : 0}
                className="text-surface-300 text-sm leading-relaxed"
              />
            </div>
            <button
              onClick={() =>
                isSpeaking && spokenSource === 'insight'
                  ? stopPlayback()
                  : speak(insightText, insightItem?.audio?.[language], 'insight')
              }
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-aurora text-white font-medium"
            >
              {isSpeaking && spokenSource === 'insight' ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
              {isSpeaking && spokenSource === 'insight' ? t('Ferma') : t('Ascolta')}
            </button>
          </>
        ) : (
          <p className="text-surface-400 text-sm">{t('Nessun contenuto disponibile.')}</p>
        )}
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

      {/* Testo a schermo intero — sopra tutto il resto, mappa inclusa (z
          più alto dei suoi z-50) per restare leggibile anche se entrambi
          fossero aperti insieme. */}
      <AnimatePresence>
        {showFullscreenText && (
          <motion.div
            className="fixed inset-0 z-[70] bg-surface-950 flex flex-col safe-top safe-bottom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
              {currentText ? (
                <HighlightedText
                  text={currentText}
                  highlightUpTo={spokenSource === 'step' ? spokenCharIndex : 0}
                  className="text-2xl sm:text-3xl leading-relaxed text-surface-200 max-w-3xl mx-auto"
                />
              ) : (
                <p className="text-2xl sm:text-3xl leading-relaxed text-surface-200 max-w-3xl mx-auto">
                  {t('Nessun contenuto disponibile per questa tappa.')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Immagine a schermo intero, aperta toccando l'opera — stesso z della
          versione testo, mai le due insieme (l'una chiude l'altra tappa
          per tappa comunque, ma non c'è un caso in cui servano assieme). */}
      <AnimatePresence>
        {showFullscreenImage && heroImage && (
          <motion.div
            className="fixed inset-0 z-[70] bg-surface-950 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
