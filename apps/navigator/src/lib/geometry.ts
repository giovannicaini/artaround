import type { MapPoint } from '@artaround/shared';

/** Centroide di un poligono chiuso (primo punto = ultimo) — solo per
 * posizionare l'etichetta col titolo al centro del contorno di una sala. */
export function polygonCentroid(points: MapPoint[]): MapPoint {
  const pts =
    points.length > 1 &&
    points[0].x === points[points.length - 1].x &&
    points[0].y === points[points.length - 1].y
      ? points.slice(0, -1)
      : points;

  if (pts.length === 0) return { x: 0, y: 0 };

  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length };
}
