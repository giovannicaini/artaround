/*
 * File: /src/context/playbackRateStore.ts                                               *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 14/09/2026                                                             *
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

import { create } from 'zustand';
import { audioPlaybackService, loadStoredPlaybackRate } from '../services/audioPlayback';

interface PlaybackRateState {
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
}

// Velocità della lettura ad alta voce (audio generato e sintesi vocale del
// browser): preferenza di dispositivo, persiste tra una visita e l'altra.
export const usePlaybackRateStore = create<PlaybackRateState>((set) => ({
  playbackRate: loadStoredPlaybackRate(),
  setPlaybackRate: (playbackRate) => {
    audioPlaybackService.setPlaybackRate(playbackRate);
    set({ playbackRate });
  },
}));
