import type { MapPoint } from '@artaround/shared';

/**
 * Utility geometriche per i poligoni delle sale (MuseumRoom.polygon).
 */
// Ray casting: true se il punto è dentro il poligono (chiuso o no, non importa).
export function isPointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(polygon: MapPoint[]): MapPoint {
  const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / polygon.length, y: sum.y / polygon.length };
}

// Punto casuale dentro il poligono, a distanza minima dai punti già piazzati in questo stesso batch (per non far sovrapporre i…
export function randomPointInPolygon(
  polygon: MapPoint[],
  existingPoints: MapPoint[] = [],
  minDistance = 22,
  maxAttempts = 300,
): MapPoint {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const farEnough = (point: MapPoint) =>
    existingPoints.every((p) => Math.hypot(p.x - point.x, p.y - point.y) >= minDistance);

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
    if (isPointInPolygon(candidate, polygon) && farEnough(candidate)) {
      return candidate;
    }
  }

  // Sala affollata: rilassa il vincolo di distanza minima, basta stare dentro.
  for (let i = 0; i < maxAttempts; i++) {
    const candidate = {
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
    };
    if (isPointInPolygon(candidate, polygon)) {
      return candidate;
    }
  }

  return polygonCentroid(polygon);
}
