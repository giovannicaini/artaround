import { BookOpen, Info, Navigation as NavigationIcon } from 'lucide-react';
import { LanguageLevel, ContentDuration, getReferenceTypeLabel } from '@artaround/shared';
import type { PlayerStep } from '../context/visitSessionStore';
import { pickItemForPreferences } from '../services/content';
import { useT } from '../services/useT';
import { Sheet } from './ui';

interface StepListSheetProps {
  open: boolean;
  onClose: () => void;
  steps: PlayerStep[];
  currentStepIndex: number;
  languageLevel: LanguageLevel;
  contentDuration: ContentDuration;
  onGoToStep: (index: number) => void;
}

export function StepListSheet({
  open,
  onClose,
  steps,
  currentStepIndex,
  languageLevel,
  contentDuration,
  onGoToStep,
}: StepListSheetProps) {
  const t = useT();

  return (
    <Sheet open={open} onClose={onClose} title={t('Tappe della visita')}>
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
                onGoToStep(idx);
                onClose();
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
  );
}
