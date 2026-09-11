/**
 * generate-navigator-branding-assets.ts
 *
 * Genera icone PWA, logo e immagine di apertura per le NavigatorConfig che
 * ne sono prive, usando i colori di brand della config stessa (non un
 * placeholder generico uguale per tutte) — un badge con l'iniziale del
 * nome su gradiente primaryColor→secondaryColor per icone/logo, un motivo
 * "aurora" (stesso linguaggio visivo del Navigator, vedi main.css) per
 * l'immagine di apertura.
 *
 * Uso:
 *   npx tsx src/scripts/generate-navigator-branding-assets.ts [--dry-run]
 */

import sharp from 'sharp';
import { connectDB } from '../config/database.js';
import { NavigatorConfigModel } from '../models/index.js';
import { UploadService } from '../utils/upload.service.js';

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!,
  );
}

function initial(name: string): string {
  return (name.trim()[0] || 'A').toUpperCase();
}

// Badge con iniziale su gradiente — usato per icone PWA e logo.
// safeZone: frazione del lato lasciata libera intorno al badge (le icone
// maskable possono essere ritagliate dal sistema operativo fino a un
// cerchio dell'80% del canvas — qui il badge resta comodamente dentro).
function badgeSvg(
  size: number,
  primary: string,
  secondary: string,
  letter: string,
  safeZone: number,
): string {
  const fontSize = Math.round(size * (0.5 - safeZone));
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#g)" />
      <text x="50%" y="53%" font-family="Arial, sans-serif" font-weight="700"
        font-size="${fontSize}" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">
        ${escapeXml(letter)}
      </text>
    </svg>
  `;
}

// Sfondo "aurora" — stesso linguaggio del tema Navigator (gradiente scuro
// con due bagliori sfumati nei colori di brand), per l'immagine di apertura.
function auroraSvg(width: number, height: number, primary: string, secondary: string): string {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0b0813" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
        <radialGradient id="glow1" cx="30%" cy="25%" r="55%">
          <stop offset="0%" stop-color="${primary}" stop-opacity="0.55" />
          <stop offset="100%" stop-color="${primary}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glow2" cx="75%" cy="65%" r="50%">
          <stop offset="0%" stop-color="${secondary}" stop-opacity="0.45" />
          <stop offset="100%" stop-color="${secondary}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" fill="url(#glow1)" />
      <rect width="${width}" height="${height}" fill="url(#glow2)" />
    </svg>
  `;
}

async function uploadPng(svg: string, size: number): Promise<string> {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  const saved = await UploadService.processAndSave(buffer, `icon-${size}.png`, 'misc', {
    width: size,
    height: size,
    format: 'png',
    quality: 90,
  });
  return saved.path;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const configs = await NavigatorConfigModel.find({});
  console.log(`Config trovate: ${configs.length}`);

  for (const cfg of configs) {
    const primary = cfg.branding.primaryColor;
    const secondary = cfg.branding.secondaryColor || primary;
    const letter = initial(cfg.name);
    const changes: string[] = [];

    if (dryRun) {
      console.log(
        `[DRY-RUN] ${cfg.name}: rigenererei icone/logo con "${letter}" su ${primary}→${secondary}`,
      );
      continue;
    }

    // Icone PWA — sempre rigenerate, sostituiscono il placeholder generico
    // uguale per tutte le config (icon-*.png statici in apps/navigator/public/icons).
    cfg.pwa.icon192 = await uploadPng(badgeSvg(192, primary, secondary, letter, 0.12), 192);
    cfg.pwa.icon512 = await uploadPng(badgeSvg(512, primary, secondary, letter, 0.12), 512);
    cfg.pwa.iconMaskable = await uploadPng(badgeSvg(512, primary, secondary, letter, 0.2), 512);
    cfg.pwa.appleTouchIcon = await uploadPng(badgeSvg(180, primary, secondary, letter, 0.12), 180);
    changes.push('icone PWA');

    if (!cfg.branding.logo) {
      cfg.branding.logo = await uploadPng(badgeSvg(512, primary, secondary, letter, 0.15), 512);
      changes.push('logo');
    }

    if (!cfg.branding.splashImage && !cfg.content?.openingImage) {
      const svg = auroraSvg(1080, 1920, primary, secondary);
      const buffer = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
      const saved = await UploadService.processAndSave(buffer, 'opening.webp', 'misc', {
        format: 'webp',
        quality: 85,
      });
      cfg.branding.splashImage = saved.path;
      changes.push('immagine di apertura');
    }

    await cfg.save();
    console.log(`✅  ${cfg.name}: ${changes.join(', ')}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('Generazione asset navigator fallita:', error);
  process.exit(1);
});
