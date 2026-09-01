import { VisitStepType, type VisitStep, type MuseumFloor } from '@artaround/shared';

export interface RoutePoint {
  x: number;
  y: number;
  floorId: string;
  kind: 'artwork' | 'waypoint';
  artworkId?: string;
}

/**
 * Risolve gli step ARTWORK/WAYPOINT (nell'ordine della visita) in punti con
 * coordinate reali sulla piantina — stesso algoritmo dell'anteprima percorso
 * del marketplace (visit-editor.ts::getVisitRoutePoints). I waypoint servono
 * solo a far piegare correttamente la linea intorno ai muri (una porta su un
 * corridoio, una svolta) e non vanno mai mostrati come tappa cliccabile al
 * visitatore — qui restano "kind: waypoint" apposta, così chi disegna la
 * mappa può escluderli dai marker numerati pur usandoli per la linea.
 */
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
