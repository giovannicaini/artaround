// Genera un set di icone PWA (bussola su gradiente) per una NavigatorConfig
// di museo, sugli stessi criteri di generate-default-icons.mjs ma con colori
// scelti. Uso:
//   node apps/navigator/scripts/generate-icon-set.mjs <prefix> <color1> <color2> [color3]
// Esempio:
//   node apps/navigator/scripts/generate-icon-set.mjs borghese '#c9962c' '#7a1f2b'
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const [, , prefix, color1, color2, color3] = process.argv;
if (!prefix || !color1 || !color2) {
  console.error('Uso: generate-icon-set.mjs <prefix> <color1> <color2> [color3]');
  process.exit(1);
}

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');

function compassGlyph(scale) {
  const r = 150 * scale;
  const needle = 78 * scale;
  return `
    <circle cx="256" cy="256" r="${r}" fill="none" stroke="white" stroke-width="${14 * scale}" />
    <path d="M 256 ${256 - needle} L ${256 + needle * 0.55} 256 L 256 ${256 + needle} L ${256 - needle * 0.55} 256 Z"
          fill="white" />
  `;
}

function iconSvg({ glyphScale, maskable = false }) {
  const bg = maskable
    ? `<rect width="512" height="512" fill="${color1}" />`
    : `<rect width="512" height="512" rx="112" fill="url(#g)" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color1}" />
      <stop offset="100%" stop-color="${color3 || color2}" />
    </linearGradient>
  </defs>
  ${bg}
  ${compassGlyph(glyphScale)}
</svg>`;
}

async function generate() {
  await mkdir(OUT_DIR, { recursive: true });

  const standard = Buffer.from(iconSvg({ glyphScale: 1 }));
  const maskable = Buffer.from(iconSvg({ glyphScale: 0.6, maskable: true }));

  await Promise.all([
    sharp(standard).resize(512, 512).png().toFile(path.join(OUT_DIR, `${prefix}-icon-512.png`)),
    sharp(standard).resize(192, 192).png().toFile(path.join(OUT_DIR, `${prefix}-icon-192.png`)),
    sharp(maskable)
      .resize(512, 512)
      .png()
      .toFile(path.join(OUT_DIR, `${prefix}-icon-512-maskable.png`)),
    sharp(standard)
      .resize(180, 180)
      .png()
      .toFile(path.join(OUT_DIR, `${prefix}-apple-touch-icon.png`)),
  ]);

  console.log('Icone generate in', OUT_DIR, 'con prefisso', prefix);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
