import { Play, Pause } from 'lucide-react';
import type { AppLanguage, GeneratedAudio, Item } from '@artaround/shared';
import { useT } from '../services/useT';
import { HighlightedText, Sheet } from './ui';

interface InsightSheetProps {
  insightType: 'author' | 'movement' | null;
  setInsightType: (type: 'author' | 'movement' | null) => void;
  hasAuthorInsight: boolean;
  hasMovementInsight: boolean;
  insightItem: Item | null;
  insightText: string;
  isSpeaking: boolean;
  spokenSource: 'step' | 'insight' | 'aside';
  spokenCharIndex: number;
  language: AppLanguage;
  stopPlayback: () => void;
  speak: (text: string, audio?: GeneratedAudio, source?: 'step' | 'insight' | 'aside') => void;
}

export function InsightSheet({
  insightType,
  setInsightType,
  hasAuthorInsight,
  hasMovementInsight,
  insightItem,
  insightText,
  isSpeaking,
  spokenSource,
  spokenCharIndex,
  language,
  stopPlayback,
  speak,
}: InsightSheetProps) {
  const t = useT();

  return (
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
  );
}
