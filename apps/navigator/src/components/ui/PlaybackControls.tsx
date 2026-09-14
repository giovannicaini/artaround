/*
 * File: /src/components/ui/PlaybackControls.tsx                                         *
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

import { Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';

export type PlaybackControlsVariant = 'mobile' | 'desktop';

interface PlaybackControlsProps {
  variant: PlaybackControlsVariant;
  isSpeaking: boolean;
  canPlay: boolean;
  onPlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
}

const SIDE_ICON = {
  mobile: { Prev: SkipBack, Next: SkipForward },
  desktop: { Prev: ChevronLeft, Next: ChevronRight },
};

const SIDE_BUTTON_CLASS: Record<PlaybackControlsVariant, string> = {
  mobile:
    'p-3.5 rounded-full bg-surface-800 text-surface-300 hover:bg-surface-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95',
  desktop:
    'p-3 rounded-xl bg-surface-950 border border-surface-800 text-surface-300 hover:bg-surface-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all',
};

const PLAY_BUTTON_CLASS: Record<PlaybackControlsVariant, string> = {
  mobile:
    'p-6 rounded-full gradient-aurora text-white shadow-glow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-40',
  desktop:
    'p-5 rounded-2xl gradient-aurora text-white shadow-glow-lg hover:brightness-110 transition-all disabled:opacity-40',
};

// Indietro/Play/Avanti: stesse azioni, ma layout diverso mobile / desktop.
export function PlaybackControls({
  variant,
  isSpeaking,
  canPlay,
  onPlay,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
}: PlaybackControlsProps) {
  const { Prev, Next } = SIDE_ICON[variant];
  return (
    <div className={`flex items-center justify-center ${variant === 'mobile' ? 'gap-5' : 'gap-4'}`}>
      <button onClick={onPrev} disabled={prevDisabled} className={SIDE_BUTTON_CLASS[variant]}>
        <Prev className="w-6 h-6" />
      </button>

      <button onClick={onPlay} disabled={!canPlay} className={PLAY_BUTTON_CLASS[variant]}>
        {isSpeaking ? (
          <Pause className="w-8 h-8" />
        ) : (
          <Play className={`w-8 h-8 ${variant === 'mobile' ? 'ml-1' : 'ml-0.5'}`} />
        )}
      </button>

      <button onClick={onNext} disabled={nextDisabled} className={SIDE_BUTTON_CLASS[variant]}>
        <Next className="w-6 h-6" />
      </button>
    </div>
  );
}
