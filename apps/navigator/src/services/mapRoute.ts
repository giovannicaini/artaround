import { VisitStepType, type VisitStep, type MuseumFloor, type MuseumMap } from '@artaround/shared';

export interface RoutePoint {
  x: number;
  y: number;
  floorId: string;
  kind: 'artwork' | 'waypoint';
  artworkId?: string;
}

/** Piantina del piano terra di un museo, nel formato che MapView si aspetta — null se il museo non ha piani caricati. */
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
