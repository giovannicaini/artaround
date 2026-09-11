// Genera le icone PWA di default per NavigatorConfig applicability 'global'
// (nessuna icona reale esiste ancora nel repo). Motivo bussola sui colori
// "aurora" attuali del Navigator (main.css/tailwind.config.js). Uso una tantum:
//   node apps/navigator/scripts/generate-default-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');

const PRIMARY = '#8b3ffc';
const EMBER = '#f59e0b';
const FUCHSIA = '#ec4899';

// Bussola stilizzata: cerchio + ago a diamante, stesso linguaggio visivo
// dell'icona Compass (lucide-react) usata come fallback in HomePage/MuseumPage.
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
    ? `<rect width="512" height="512" fill="${PRIMARY}" />`
    : `<rect width="512" height="512" rx="112" fill="url(#g)" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}" />
      <stop offset="55%" stop-color="${FUCHSIA}" />
      <stop offset="100%" stop-color="${EMBER}" />
    </linearGradient>
  </defs>
  ${bg}
  ${compassGlyph(glyphScale)}
</svg>`;
}

async function generate() {
  await mkdir(OUT_DIR, { recursive: true });

  const standard = Buffer.from(iconSvg({ glyphScale: 1 }));
  // Maskable: il contenuto deve stare nel cerchio di sicurezza (~80% del
  // canvas) — glifo più piccolo, sfondo pieno che arriva fino al bordo.
  const maskable = Buffer.from(iconSvg({ glyphScale: 0.6, maskable: true }));

  await Promise.all([
    sharp(standard).resize(512, 512).png().toFile(path.join(OUT_DIR, 'icon-512.png')),
    sharp(standard).resize(192, 192).png().toFile(path.join(OUT_DIR, 'icon-192.png')),
    sharp(maskable).resize(512, 512).png().toFile(path.join(OUT_DIR, 'icon-512-maskable.png')),
    sharp(standard).resize(180, 180).png().toFile(path.join(OUT_DIR, 'apple-touch-icon.png')),
  ]);

  await writeFile(
    path.join(OUT_DIR, 'README.md'),
    '# Icone di default generate\n\nRigenerale con `node apps/navigator/scripts/generate-default-icons.mjs`.\n',
  );

  console.log('Icone generate in', OUT_DIR);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
