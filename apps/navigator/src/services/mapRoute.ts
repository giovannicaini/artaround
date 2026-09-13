/*
 * File: mapRoute.ts                                                                     *
 * Project: @artaround/navigator                                                         *
 * Last Modified: 11/09/2026                                                             *
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
 * Utility per costruire la rappresentazione della mappa del museo e per
 * risolvere le tappe della visita in punti con coordinate sulla piantina
 * (usati da `MapView` per disegnare il percorso). Esporta `buildMuseumMap`
 * e `buildVisitRoutePoints`.
 */

import { VisitStepType, type VisitStep, type MuseumFloor, type MuseumMap } from '@artaround/shared';

// Identifica punto esatto (coordinate su un piano)
export interface RoutePoint {
  x: number;
  y: number;
  floorId: string;
  kind: 'artwork' | 'waypoint';
  artworkId?: string;
}

// Piantina del piano [0] di un museo, nel formato che MapView si aspetta — null se il museo non ha piani caricati.
export function buildMuseumMap(museum: {
  floors?: MuseumFloor[];
  rooms?: MuseumMap['rooms'];
}): MuseumMap | null {
  const firstFloor = museum.floors?.[0];
  if (!firstFloor) return null;
  return {
    type: 'svg',
    svgContent: firstFloor.svgContent,
    dimensions: firstFloor.dimensions,
    markers: firstFloor.markers,
    floors: museum.floors,
    rooms: museum.rooms,
  };
}

// Cerca un marker che soddisfi predicate sui piani, nell'ordine — il primo trovato vince.
function findMarker(
  floors: MuseumFloor[],
  predicate: (m: MuseumFloor['markers'][number]) => boolean,
) {
  for (const floor of floors) {
    const marker = floor.markers?.find(predicate);
    if (marker) return { floor, marker };
  }
  return null;
}

/**
 * Risolve gli step ARTWORK/WAYPOINT in punti con coordinate sulla piantina.
 * I waypoint servono solo a far piegare la linea intorno ai muri, mai marker cliccabili.
 */
export function buildVisitRoutePoints(steps: VisitStep[], floors: MuseumFloor[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  const orderedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (const step of orderedSteps) {
    if (step.type === VisitStepType.ARTWORK && step.artworkId) {
      const found = findMarker(floors, (m) => m.artworkId === step.artworkId);
      if (found) {
        points.push({
          x: found.marker.x,
          y: found.marker.y,
          floorId: found.floor.id,
          kind: 'artwork',
          artworkId: step.artworkId,
        });
      }
    } else if (step.type === VisitStepType.WAYPOINT && step.mapMarkerId) {
      const found = findMarker(floors, (m) => m.id === step.mapMarkerId);
      if (found) {
        points.push({
          x: found.marker.x,
          y: found.marker.y,
          floorId: found.floor.id,
          kind: 'waypoint',
        });
      }
    }
  }

  return points;
}
