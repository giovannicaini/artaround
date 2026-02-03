import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import { Museum, Visit, Item, CompetenceLevel, ContentDuration } from '@artaround/shared';

interface NavigatorState {
  currentMuseum: Museum | null;
  currentVisit: Visit | null;
  currentItem: Item | null;
  currentItemIndex: number;
  items: Item[];
  isSpeaking: boolean;
  isListening: boolean;
  contentLevel: CompetenceLevel;
  contentDuration: ContentDuration;
}

interface NavigatorContextType extends NavigatorState {
  setMuseum: (museum: Museum) => void;
  setVisit: (visit: Visit) => void;
  setItems: (items: Item[]) => void;
  goToItem: (index: number) => void;
  nextItem: () => void;
  prevItem: () => void;
  setContentLevel: (level: CompetenceLevel) => void;
  setContentDuration: (duration: ContentDuration) => void;
  setSpeaking: (speaking: boolean) => void;
  setListening: (listening: boolean) => void;
  getCurrentContent: () => string;
}

const NavigatorContext = createContext<NavigatorContextType | undefined>(undefined);

export function NavigatorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigatorState>({
    currentMuseum: null,
    currentVisit: null,
    currentItem: null,
    currentItemIndex: 0,
    items: [],
    isSpeaking: false,
    isListening: false,
    contentLevel: CompetenceLevel.MEDIO,
    contentDuration: ContentDuration.MEDIUM,
  });

  const setMuseum = useCallback((museum: Museum) => {
    setState((prev) => ({ ...prev, currentMuseum: museum }));
  }, []);

  const setVisit = useCallback((visit: Visit) => {
    setState((prev) => ({ ...prev, currentVisit: visit }));
  }, []);

  const setItems = useCallback((items: Item[]) => {
    setState((prev) => ({
      ...prev,
      items,
      currentItem: items[0] || null,
      currentItemIndex: 0,
    }));
  }, []);

  const goToItem = useCallback((index: number) => {
    setState((prev) => {
      if (index >= 0 && index < prev.items.length) {
        return {
          ...prev,
          currentItemIndex: index,
          currentItem: prev.items[index],
        };
      }
      return prev;
    });
  }, []);

  const nextItem = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentItemIndex + 1;
      if (nextIndex < prev.items.length) {
        return {
          ...prev,
          currentItemIndex: nextIndex,
          currentItem: prev.items[nextIndex],
        };
      }
      return prev;
    });
  }, []);

  const prevItem = useCallback(() => {
    setState((prev) => {
      const prevIndex = prev.currentItemIndex - 1;
      if (prevIndex >= 0) {
        return {
          ...prev,
          currentItemIndex: prevIndex,
          currentItem: prev.items[prevIndex],
        };
      }
      return prev;
    });
  }, []);

  const setContentLevel = useCallback((level: CompetenceLevel) => {
    setState((prev) => ({ ...prev, contentLevel: level }));
  }, []);

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
    const { currentItem, contentLevel, contentDuration } = state;
    if (!currentItem) return '';

    // Find matching content based on level and duration
    const content = currentItem.contents.find(
      (c) => c.language === contentLevel && c.duration === contentDuration,
    );

    // Fallback to any content with same duration
    if (!content) {
      const fallback = currentItem.contents.find((c) => c.duration === contentDuration);
      return fallback?.text || currentItem.contents[0]?.text || '';
    }

    return content.text;
  }, [state]);

  return (
    <NavigatorContext.Provider
      value={{
        ...state,
        setMuseum,
        setVisit,
        setItems,
        goToItem,
        nextItem,
        prevItem,
        setContentLevel,
        setContentDuration,
        setSpeaking,
        setListening,
        getCurrentContent,
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
