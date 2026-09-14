/*
 * File: /src/services/routePath.ts                                                      *
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
 * Utility per generare percorsi "morbidi" e frecce direzionali sulla piantina
 * di una visita.
 */
export interface Point {
  x: number;
  y: number;
}

interface BezierSegment {
  p0: Point;
  c1: Point;
  c2: Point;
  p1: Point;
}

// Catmull-Rom → bezier cubiche (tensione 1/6): la curva passa esattamente
// per ogni punto della lista con tangente continua, senza spigoli vivi
// come con una spezzata M-L-L-L.
function catmullRomToBezierSegments(points: Point[]): BezierSegment[] {
  const segments: BezierSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    segments.push({
      p0: p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p1: p2,
    });
  }
  return segments;
}

function pointOnCubic(seg: BezierSegment, t: number): Point {
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * seg.p0.x +
      3 * mt * mt * t * seg.c1.x +
      3 * mt * t * t * seg.c2.x +
      t * t * t * seg.p1.x,
    y:
      mt * mt * mt * seg.p0.y +
      3 * mt * mt * t * seg.c1.y +
      3 * mt * t * t * seg.c2.y +
      t * t * t * seg.p1.y,
  };
}

/** Percorso morbido che passa per tutti i punti (opere + waypoint), senza spigoli vivi sulle svolte. */
export function buildSmoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (const seg of catmullRomToBezierSegments(points)) {
    d += ` C ${seg.c1.x} ${seg.c1.y}, ${seg.c2.x} ${seg.c2.y}, ${seg.p1.x} ${seg.p1.y}`;
  }
  return d;
}

export interface PathArrow extends Point {
  angleDeg: number;
}

/** Frecce di verso ogni `spacing` px lungo la curva (non lungo i segmenti, di lunghezza diversa). */
export function computePathArrows(points: Point[], spacing = 90): PathArrow[] {
  if (points.length < 2) return [];
  const segments = catmullRomToBezierSegments(points);
  const SAMPLES_PER_SEGMENT = 24;
  const samples: Point[] = [];
  for (const seg of segments) {
    for (let s = 0; s <= SAMPLES_PER_SEGMENT; s++) {
      samples.push(pointOnCubic(seg, s / SAMPLES_PER_SEGMENT));
    }
  }

  const cumulative: number[] = [0];
  for (let i = 1; i < samples.length; i++) {
    cumulative.push(
      cumulative[i - 1] +
        Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y),
    );
  }
  const totalLength = cumulative[cumulative.length - 1];
  if (totalLength < spacing) return [];

  // Margine iniziale/finale perché le frecce non finiscano sotto ai marker
  // di inizio/fine tappa.
  const margin = Math.min(spacing / 2, totalLength / 4);
  const arrows: PathArrow[] = [];
  let target = margin;
  let idx = 1;
  while (target < totalLength - margin && idx < samples.length) {
    while (idx < samples.length - 1 && cumulative[idx] < target) idx++;
    const prev = samples[idx - 1];
    const curr = samples[idx];
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (dx !== 0 || dy !== 0) {
      arrows.push({ x: curr.x, y: curr.y, angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI });
    }
    target += spacing;
  }
  return arrows;
}
