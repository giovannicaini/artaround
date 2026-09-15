/*
 * File: /src/display/museum.display.ts                                                  *
 * Project: @artaround/shared                                                            *
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

/**
 * Etichette e icone dei tipi di marker sulla piantina di un museo.
 */
import { MarkerType } from '../types/museum.types';
import type { SelectOption } from './common';

export const MARKER_TYPE_META: Readonly<Record<MarkerType, { label: string; icon: string }>> = {
  [MarkerType.ARTWORK]: { label: 'Opera', icon: '🖼️' },
  [MarkerType.SCULPTURE]: { label: 'Scultura', icon: '🗿' },
  [MarkerType.PAINTING]: { label: 'Dipinto', icon: '🎨' },
  [MarkerType.ENTRANCE]: { label: 'Ingresso', icon: '🚪' },
  [MarkerType.EXIT]: { label: 'Uscita', icon: '🚶' },
  [MarkerType.EMERGENCY_EXIT]: { label: 'Uscita Emergenza', icon: '🚨' },
  [MarkerType.INFO_POINT]: { label: 'Info Point', icon: 'ℹ️' },
  [MarkerType.ELEVATOR]: { label: 'Ascensore', icon: '🛗' },
  [MarkerType.STAIRS]: { label: 'Scale', icon: '🪜' },
  [MarkerType.ESCALATOR]: { label: 'Scale Mobili', icon: '🎢' },
  [MarkerType.RAMP]: { label: 'Rampa', icon: '🛤️' },
  [MarkerType.TOILETTE]: { label: 'Bagni', icon: '🚻' },
  [MarkerType.ACCESSIBLE_TOILETTE]: { label: 'Bagni Accessibili', icon: '♿' },
  [MarkerType.BAR]: { label: 'Bar', icon: '☕' },
  [MarkerType.RESTAURANT]: { label: 'Ristorante', icon: '🍽️' },
  [MarkerType.SHOP]: { label: 'Negozio', icon: '🛒' },
  [MarkerType.CLOAKROOM]: { label: 'Guardaroba', icon: '🧥' },
  [MarkerType.LOCKER]: { label: 'Armadietti', icon: '🔐' },
  [MarkerType.ROOM]: { label: 'Sala', icon: '🚪' },
  [MarkerType.GALLERY]: { label: 'Galleria', icon: '🏛️' },
  [MarkerType.ACCESSIBILITY]: { label: 'Accessibilità', icon: '♿' },
  [MarkerType.OBSTACLE]: { label: 'Ostacolo', icon: '⛔' },
  [MarkerType.BENCH]: { label: 'Panchina', icon: '🪑' },
  [MarkerType.AUDIO_GUIDE]: { label: 'Audioguida', icon: '🎧' },
  [MarkerType.WIFI]: { label: 'WiFi', icon: '📶' },
  [MarkerType.WAYPOINT]: { label: 'Punto di svolta percorso', icon: '•' },
};

export const MARKER_TYPE_OPTIONS_IT: ReadonlyArray<
  SelectOption<MarkerType> & { icon: string; type: MarkerType }
> = (Object.values(MarkerType) as MarkerType[]).map((type) => ({
  type,
  value: type,
  icon: MARKER_TYPE_META[type].icon,
  label: MARKER_TYPE_META[type].label,
}));

export const MARKER_TYPE_EDITOR_OPTIONS_IT: ReadonlyArray<
  SelectOption<MarkerType> & { icon: string; type: MarkerType }
> = [
  MarkerType.ARTWORK,
  MarkerType.SCULPTURE,
  MarkerType.PAINTING,
  MarkerType.ENTRANCE,
  MarkerType.EXIT,
  MarkerType.EMERGENCY_EXIT,
  MarkerType.INFO_POINT,
  MarkerType.ELEVATOR,
  MarkerType.STAIRS,
  MarkerType.ESCALATOR,
  MarkerType.RAMP,
  MarkerType.TOILETTE,
  MarkerType.ACCESSIBLE_TOILETTE,
  MarkerType.BAR,
  MarkerType.RESTAURANT,
  MarkerType.SHOP,
  MarkerType.CLOAKROOM,
  MarkerType.LOCKER,
  MarkerType.ROOM,
  MarkerType.GALLERY,
  MarkerType.BENCH,
  MarkerType.AUDIO_GUIDE,
  MarkerType.WIFI,
  MarkerType.WAYPOINT,
].map((type) => ({
  type,
  value: type,
  icon: MARKER_TYPE_META[type].icon,
  label: MARKER_TYPE_META[type].label,
}));

// Lista fissa e limitata di servizi attivabili per museo (vedi MuseumService)
// — un sottoinsieme di MarkerType, quelli che ha senso offrire come "servizio"
// oltre a semplice punto sulla mappa.
export const MUSEUM_SERVICE_TYPES: readonly MarkerType[] = [
  MarkerType.EXIT,
  MarkerType.TOILETTE,
  MarkerType.ACCESSIBLE_TOILETTE,
  MarkerType.BAR,
  MarkerType.RESTAURANT,
  MarkerType.SHOP,
  MarkerType.CLOAKROOM,
  MarkerType.LOCKER,
  MarkerType.INFO_POINT,
  MarkerType.WIFI,
  MarkerType.AUDIO_GUIDE,
];

export const MUSEUM_SERVICE_TYPE_OPTIONS: ReadonlyArray<
  SelectOption<MarkerType> & { icon: string; type: MarkerType }
> = MUSEUM_SERVICE_TYPES.map((type) => ({
  type,
  value: type,
  icon: MARKER_TYPE_META[type].icon,
  label: MARKER_TYPE_META[type].label,
}));
