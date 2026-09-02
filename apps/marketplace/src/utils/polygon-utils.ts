import type { MapPoint } from '@artaround/shared';

// geometria per i poligoni delle sale, usata per generare marker distribuiti
// dentro il contorno di una sala

// ray casting: true se il punto è dentro il poligono (chiuso o no, non importa)
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

// punto casuale nel poligono, lontano dai punti già piazzati (rejection
// sampling sul bounding box); se non trova nulla rilassa il vincolo di
// distanza, e come ultima spiaggia usa il centroide
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

  // sala affollata: basta stare dentro il poligono, pazienza per la distanza
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
