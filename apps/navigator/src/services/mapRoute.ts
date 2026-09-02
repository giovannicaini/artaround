import { VisitStepType, type VisitStep, type MuseumFloor } from '@artaround/shared';

export interface RoutePoint {
  x: number;
  y: number;
  floorId: string;
  kind: 'artwork' | 'waypoint';
  artworkId?: string;
}

// step ARTWORK/WAYPOINT in punti con coordinate reali, i waypoint restano
// "kind: waypoint" per essere esclusi dai marker numerati ma usati per la linea
export function buildVisitRoutePoints(steps: VisitStep[], floors: MuseumFloor[]): RoutePoint[] {
  const points: RoutePoint[] = [];
  const orderedSteps = [...steps].sort((a, b) => a.order - b.order);

  for (const step of orderedSteps) {
    if (step.type === VisitStepType.ARTWORK && step.artworkId) {
      for (const floor of floors) {
        const marker = floor.markers?.find((m) => m.artworkId === step.artworkId);
        if (marker) {
          points.push({
            x: marker.x,
            y: marker.y,
            floorId: floor.id,
            kind: 'artwork',
            artworkId: step.artworkId,
          });
          break;
        }
      }
    } else if (step.type === VisitStepType.WAYPOINT && step.mapMarkerId) {
      for (const floor of floors) {
        const marker = floor.markers?.find((m) => m.id === step.mapMarkerId);
        if (marker) {
          points.push({ x: marker.x, y: marker.y, floorId: floor.id, kind: 'waypoint' });
          break;
        }
      }
    }
  }

  return points;
}
