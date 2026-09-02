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

// forma di luminosità della rampa di default, riusabile con una tinta qualsiasi
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

// genera una rampa di 11 triplette RGB da un colore esadecimale, null se non valido
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
