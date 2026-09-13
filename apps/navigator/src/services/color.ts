/*
 * File: color.ts                                                                        *
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
 * Utility per la generazione di rampe di colore a 11 step a partire da un
 * colore esadecimale. Fornisce "buildBrandRamp" (rampa d'accento più
 * saturata) e "buildSurfaceRamp" (rampa neutra per superfici/temi). Il flusso
 * interno è: hex → HSL → RGB triplet, pronto per essere usato in CSS.
 * Usata per navigator con colori personalizzati impostati via config.
 */
interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return null;
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgbTriplet(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toByte = (v: number) => Math.round((v + m) * 255);
  return `${toByte(r)} ${toByte(g)} ${toByte(b)}`;
}

// Luminosità per ciascuno degli 11 stop della rampa — dà scala completa a qualsiasi tinta di museo.
const LIGHTNESS_CURVE: Record<string, number> = {
  '50': 95,
  '100': 90,
  '200': 80,
  '300': 70,
  '400': 64,
  '500': 58,
  '600': 48,
  '700': 38,
  '800': 29,
  '900': 20,
  '950': 12,
};

/** Genera una rampa di 11 triplette RGB da un colore esadecimale — null se l'hex non è valido. */
export function buildBrandRamp(hex: string): Record<string, string> | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;

  // Satura un po' meno agli estremi chiari/scuri: eviterebbero toni acidi.
  const ramp: Record<string, string> = {};
  for (const [stop, l] of Object.entries(LIGHTNESS_CURVE)) {
    const distanceFromMid = Math.abs(l - 55) / 55;
    const s = Math.max(30, hsl.s * (1 - distanceFromMid * 0.35));
    ramp[stop] = hslToRgbTriplet(hsl.h, s, l);
  }
  return ramp;
}

// Da quasi bianco a quasi nero (non solo la fascia di un accento) con un'impronta di tinta.
const SURFACE_LIGHTNESS_CURVE: Record<string, number> = {
  '50': 97,
  '100': 94,
  '200': 84,
  '300': 68,
  '400': 55,
  '500': 42,
  '600': 32,
  '700': 24,
  '800': 16,
  '900': 10,
  '950': 6,
};

/**
 * Genera una rampa neutra a 11 passi: saturazione bassa e fissa, resta
 * "grigio scelto" mai un tono pieno. In tutta l'app 950 è lo sfondo pagina e
 * 50 il testo principale (bg-surface-950/text-surface-50): se il colore di
 * sfondo scelto è chiaro, la curva va invertita (950 chiaro, 50 scuro), o un
 * "sfondo bianco" resterebbe di fatto un tema scuro con testo bianco su
 * sfondo bianco.
 */
export function buildSurfaceRamp(hex: string): Record<string, string> | null {
  const hsl = hexToHsl(hex);
  if (!hsl) return null;

  const isLightSeed = hsl.l >= 50;
  const stops = Object.keys(SURFACE_LIGHTNESS_CURVE);
  const lightnessValues = Object.values(SURFACE_LIGHTNESS_CURVE);
  const orderedValues = isLightSeed ? [...lightnessValues].reverse() : lightnessValues;

  const ramp: Record<string, string> = {};
  stops.forEach((stop, i) => {
    ramp[stop] = hslToRgbTriplet(hsl.h, 22, orderedValues[i]);
  });
  return ramp;
}
