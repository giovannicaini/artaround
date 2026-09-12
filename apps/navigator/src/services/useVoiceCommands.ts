import { useCallback, useState } from 'react';
import {
  LanguageLevel,
  ContentDuration,
  MarkerType,
  type AppLanguage,
  type GeneratedAudio,
  type MuseumService,
} from '@artaround/shared';
import { api } from './apiClient';
import { voiceRecognitionService, parseVoiceCommand } from './speech';
import { pickItemForPreferences, localizedItemText } from './content';
import { format, localizedField } from './i18n';
import { useT } from './useT';
import type { PlayerStep } from '../context/visitSessionStore';

interface UseVoiceCommandsOptions {
  currentStep: PlayerStep | null;
  currentText: string;
  languageLevel: LanguageLevel;
  contentDuration: ContentDuration;
  language: AppLanguage;
  activeServices: MuseumService[] | undefined;
  isListening: boolean;
  setListening: (value: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
  handlePlay: () => void;
  stopBackends: () => void;
  stopPlayback: () => void;
  shiftDuration: (delta: number) => void;
  shiftLevel: (delta: number) => void;
  speak: (text: string, audio?: GeneratedAudio, source?: 'step' | 'insight' | 'aside') => void;
  setSelectedService: (service: MuseumService | null) => void;
  setInsightType: (type: 'author' | 'movement' | null) => void;
  setShowSettings: (value: boolean) => void;
  setShowQuickActions: (value: boolean) => void;
}

export function useVoiceCommands({
  currentStep,
  currentText,
  languageLevel,
  contentDuration,
  language,
  activeServices,
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
}: UseVoiceCommandsOptions) {
  const t = useT();

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
          const service = (activeServices || []).find((s) => typesToTry.includes(s.type));
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
      activeServices,
      setSelectedService,
      setInsightType,
      setShowSettings,
      setShowQuickActions,
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

  return { handleVoice, isClassifyingVoice };
}
