import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import { Museum, Visit, Item, Artwork, LanguageLevel, ContentDuration } from '@artaround/shared';

/**
 * VisitStep data for navigation
 * Each step has an artwork and associated content items
 */
interface NavigatorStep {
  artwork: Artwork;
  items: Item[]; // Content items for this artwork
  selectedItem: Item | null; // Currently selected item based on preferences
}

interface NavigatorState {
  currentMuseum: Museum | null;
  currentVisit: Visit | null;
  // New structure: steps instead of items
  steps: NavigatorStep[];
  currentStepIndex: number;
  currentStep: NavigatorStep | null;
  isSpeaking: boolean;
  isListening: boolean;
  languageLevel: LanguageLevel;
  contentDuration: ContentDuration;
}

interface NavigatorContextType extends NavigatorState {
  setMuseum: (museum: Museum) => void;
  setVisit: (visit: Visit) => void;
  setSteps: (steps: NavigatorStep[]) => void;
  goToStep: (index: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setLanguageLevel: (level: LanguageLevel) => void;
  setContentDuration: (duration: ContentDuration) => void;
  setSpeaking: (speaking: boolean) => void;
  setListening: (listening: boolean) => void;
  getCurrentContent: () => string;
  // Legacy compatibility
  currentItem: Item | null;
  items: Item[];
  currentItemIndex: number;
  goToItem: (index: number) => void;
  nextItem: () => void;
  prevItem: () => void;
  setItems: (items: Item[]) => void;
  contentLevel: LanguageLevel;
  setContentLevel: (level: LanguageLevel) => void;
}

const NavigatorContext = createContext<NavigatorContextType | undefined>(undefined);

export function NavigatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigatorState>({
    currentMuseum: null,
    currentVisit: null,
    steps: [],
    currentStepIndex: 0,
    currentStep: null,
    isSpeaking: false,
    isListening: false,
    languageLevel: LanguageLevel.MEDIUM,
    contentDuration: ContentDuration.MEDIUM,
  });

  const setMuseum = useCallback((museum: Museum) => {
    setState((prev) => ({ ...prev, currentMuseum: museum }));
  }, []);

  const setVisit = useCallback((visit: Visit) => {
    setState((prev) => ({ ...prev, currentVisit: visit }));
  }, []);

  const setSteps = useCallback((steps: NavigatorStep[]) => {
    setState((prev) => ({
      ...prev,
      steps,
      currentStep: steps[0] || null,
      currentStepIndex: 0,
    }));
  }, []);

  // Legacy: setItems for backwards compatibility
  const setItems = useCallback(
    (items: Item[]) => {
      // Convert items to steps (one step per item)
      const steps: NavigatorStep[] = items.map((item) => ({
        artwork: {
          _id: item._id,
          wikidataId: item.referenceId || '',
          museumId: '',
          title: item.referenceTitle || item.title,
          artworkType: 'other',
          image: item.image || '',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Artwork,
        items: [item],
        selectedItem: item,
      }));
      setSteps(steps);
    },
    [setSteps],
  );

  const goToStep = useCallback((index: number) => {
    setState((prev) => {
      if (index >= 0 && index < prev.steps.length) {
        return {
          ...prev,
          currentStepIndex: index,
          currentStep: prev.steps[index],
        };
      }
      return prev;
    });
  }, []);

  // Legacy alias
  const goToItem = goToStep;

  const nextStep = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentStepIndex + 1;
      if (nextIndex < prev.steps.length) {
        return {
          ...prev,
          currentStepIndex: nextIndex,
          currentStep: prev.steps[nextIndex],
        };
      }
      return prev;
    });
  }, []);

  // Legacy alias
  const nextItem = nextStep;

  const prevStep = useCallback(() => {
    setState((prev) => {
      const prevIndex = prev.currentStepIndex - 1;
      if (prevIndex >= 0) {
        return {
          ...prev,
          currentStepIndex: prevIndex,
          currentStep: prev.steps[prevIndex],
        };
      }
      return prev;
    });
  }, []);

  // Legacy alias
  const prevItem = prevStep;

  const setLanguageLevel = useCallback((level: LanguageLevel) => {
    setState((prev) => ({ ...prev, languageLevel: level }));
  }, []);

  // Legacy alias
  const setContentLevel = setLanguageLevel;

  const setContentDuration = useCallback((duration: ContentDuration) => {
    setState((prev) => ({ ...prev, contentDuration: duration }));
  }, []);

  const setSpeaking = useCallback((speaking: boolean) => {
    setState((prev) => ({ ...prev, isSpeaking: speaking }));
  }, []);

  const setListening = useCallback((listening: boolean) => {
    setState((prev) => ({ ...prev, isListening: listening }));
  }, []);

  const getCurrentContent = useCallback(() => {
    const { currentStep, languageLevel, contentDuration } = state;
    if (!currentStep) return '';

    // Find matching item based on preferences
    const matchingItem = currentStep.items.find(
      (item) => item.languageLevel === languageLevel && item.duration === contentDuration,
    );

    if (matchingItem) return matchingItem.text;

    // Fallback: find by duration only
    const durationMatch = currentStep.items.find((item) => item.duration === contentDuration);
    if (durationMatch) return durationMatch.text;

    // Final fallback: first available item
    return currentStep.items[0]?.text || '';
  }, [state]);

  // Legacy: compute currentItem from currentStep
  const currentItem = state.currentStep?.selectedItem || state.currentStep?.items[0] || null;
  const items = state.steps.flatMap((step) => step.items);
  const currentItemIndex = state.currentStepIndex;

  return (
    <NavigatorContext.Provider
      value={{
        ...state,
        setMuseum,
        setVisit,
        setSteps,
        goToStep,
        nextStep,
        prevStep,
        setLanguageLevel,
        setContentDuration,
        setSpeaking,
        setListening,
        getCurrentContent,
        // Legacy compatibility
        currentItem,
        items,
        currentItemIndex,
        goToItem,
        nextItem,
        prevItem,
        setItems,
        contentLevel: state.languageLevel,
        setContentLevel,
      }}
    >
      {children}
    </NavigatorContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNavigator() {
  const context = useContext(NavigatorContext);
  if (!context) {
    throw new Error('useNavigator must be used within NavigatorProvider');
  }
  return context;
}
