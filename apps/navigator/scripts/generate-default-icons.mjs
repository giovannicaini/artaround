// Genera le icone PWA di default per NavigatorConfig applicability 'global' —
// rosa dei venti a 8 punte sul gradiente .gradient-aurora reale (main.css),
// stesso segno usato per tutte le altre NavigatorConfig (vedi
// MUSEUM_SERVICE_TYPE_OPTIONS/marketplace, mai una lettera). Uso una tantum:
//   node apps/navigator/scripts/generate-default-icons.mjs
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');

// Stessi due colori/stop di .gradient-aurora in main.css — non un terzo
// colore intermedio che lì non esiste.
const PRIMARY = '#8b3ffc';
const EMBER = '#f59e0b';

function compassRoseGlyph(scale) {
  return `
    <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
      <path d="M256 30 L302 256 L256 482 L210 256 Z" fill="white"/>
      <path d="M30 256 L256 210 L482 256 L256 302 Z" fill="white"/>
      <path d="M256 122 L281 256 L256 390 L231 256 Z" fill="white" transform="rotate(45 256 256)"/>
      <path d="M256 122 L281 256 L256 390 L231 256 Z" fill="white" transform="rotate(135 256 256)"/>
    </g>
  `;
}

function iconSvg({ glyphScale }) {
  // Canvas quadrato, mai arrotondato qui: ci pensa il sistema operativo
  // (icona standard) o la maschera (maskable) — un doppio arrotondamento
  // lascerebbe angoli visibili su chi non applica la propria maschera.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${PRIMARY}" />
      <stop offset="100%" stop-color="${EMBER}" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)" />
  ${compassRoseGlyph(glyphScale)}
</svg>`;
}

async function generate() {
  await mkdir(OUT_DIR, { recursive: true });

  const standard = Buffer.from(iconSvg({ glyphScale: 0.7 }));
  // Maskable: il contenuto deve stare nel cerchio di sicurezza (~80% del
  // canvas) — glifo più piccolo dello standard.
  const maskable = Buffer.from(iconSvg({ glyphScale: 0.55 }));

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
