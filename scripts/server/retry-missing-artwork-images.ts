/**
 * Ritenta il recupero dell'immagine da Wikidata per le opere che ne sono rimaste prive dopo il seed.
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { connectDB } from '../config/database.js';
import { ArtworkModel, ItemModel } from '../models/index.js';
import { UploadService } from '../utils/upload.service.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FALLBACK_ARTWORK_IMAGE = '/uploads/artworks/placeholder.png';
const IMAGE_TARGET_MAX_BYTES = 512 * 1024;
const IMAGE_OPTIMIZATION_PROFILES = [
  { width: 1600, quality: 82 },
  { width: 1400, quality: 76 },
  { width: 1200, quality: 70 },
  { width: 1000, quality: 64 },
  { width: 900, quality: 58 },
  { width: 800, quality: 52 },
  { width: 700, quality: 46 },
];

const MAX_PASSES = 8;
const MAX_RETRIES = 10;
const FETCH_TIMEOUT_MS = 30_000;
const BETWEEN_ARTWORKS_MS = 400;

type ArtworkSourceMeta = {
  wikidataId: string;
  museumId?: string;
  title?: string;
  author?: string;
  seedImage?: string;
  sourceUrl?: string;
  inventoryNumber?: string | null;
};

type CandidateImage = {
  url: string;
  source: string;
  score: number;
};

type CommonsApiPage = {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    width?: number;
    height?: number;
  }>;
};

type WikidataEntity = {
  claims?: {
    P18?: Array<{
      mainsnak?: {
        datavalue?: {
          value?: string;
        };
      };
    }>;
  };
  sitelinks?: {
    commonswiki?: {
      title?: string;
    };
  };
};

const wikidataEntityCache = new Map<string, WikidataEntity>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeHttpUrl(value: string | null | undefined): string | null {
  const url = String(value ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return null;
  if (url.includes('No%20image')) return null;
  return url;
}

function slugTokens(value: string | null | undefined): string[] {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function extractInventoryDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D+/g, '');
}

function padBorgheseInventory(value: string | null | undefined): string | null {
  const digits = extractInventoryDigits(value);
  if (!digits) return null;
  return digits.slice(-3).padStart(3, '0');
}

function isLikelyRasterImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp)(?:[?#]|$)/i.test(url);
}

function isBadImageUrl(url: string): boolean {
  return /(?:no%20image|placeholder|logo|icon|sprite|avatar|banner|facebook|instagram)/i.test(url);
}

function normalizeCandidateUrl(rawUrl: string, baseUrl?: string): string | null {
  const input = String(rawUrl ?? '').trim();
  if (!input || /^data:|^javascript:/i.test(input)) return null;

  try {
    const absolute = baseUrl ? new URL(input, baseUrl).href : new URL(input).href;
    if (!/^https?:\/\//i.test(absolute)) return null;
    if (isBadImageUrl(absolute)) return null;
    if (!isLikelyRasterImageUrl(absolute) && !/Special:FilePath/i.test(absolute)) return null;
    return absolute;
  } catch {
    return null;
  }
}

function scoreCandidate(url: string, meta: ArtworkSourceMeta, source: string): number {
  let score = 0;
  const lower = url.toLowerCase();
  const titleTokens = slugTokens(meta.title);
  const authorTokens = slugTokens(meta.author);
  const inventoryDigits = extractInventoryDigits(meta.inventoryNumber);
  const borgheseInventory = padBorgheseInventory(meta.inventoryNumber);

  if (source === 'seed-image') score += 220;
  if (source === 'source-page-meta') score += 180;
  if (source === 'source-page-html') score += 120;
  if (source === 'source-page-borghese-direct') score += 210;
  if (source === 'wikidata-p18') score += 170;
  if (source === 'wikidata-commons-file') score += 160;
  if (source === 'wikidata-commons-category') score += 110;

  if (/uploads\/server\/files\/(?!thumbnail|medium)/i.test(lower)) score += 90;
  if (/upload\.wikimedia\.org/i.test(lower)) score += 60;
  if (/special:filepath/i.test(lower)) score += 40;
  if (/thumb\//i.test(lower)) score -= 10;
  if (/thumbnail|medium/i.test(lower)) score -= 25;
  if (/detail|particolare|volto|viso|piedi|testa|crop/i.test(lower)) score -= 18;

  if (inventoryDigits && lower.includes(inventoryDigits)) score += 30;
  if (borgheseInventory && lower.includes(`/${borgheseInventory}.`)) score += 45;

  score += Math.min(30, titleTokens.filter((token) => lower.includes(token)).length * 6);
  score += Math.min(18, authorTokens.filter((token) => lower.includes(token)).length * 3);

  return score;
}

function pushCandidate(
  results: Map<string, CandidateImage>,
  rawUrl: string | null | undefined,
  source: string,
  meta: ArtworkSourceMeta,
  baseUrl?: string,
): void {
  const normalized = normalizeCandidateUrl(rawUrl ?? '', baseUrl);
  if (!normalized) return;
  const score = scoreCandidate(normalized, meta, source);
  const existing = results.get(normalized);
  if (!existing || score > existing.score) {
    results.set(normalized, { url: normalized, source, score });
  }
}

function extractHtmlImageCandidates(
  html: string,
  pageUrl: string,
  meta: ArtworkSourceMeta,
): CandidateImage[] {
  const results = new Map<string, CandidateImage>();
  const patterns: Array<{ regex: RegExp; source: string }> = [
    {
      regex:
        /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
      source: 'source-page-meta',
    },
    {
      regex:
        /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*>/gi,
      source: 'source-page-meta',
    },
    {
      regex: /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/gi,
      source: 'source-page-meta',
    },
    {
      regex: /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["'][^>]*>/gi,
      source: 'source-page-meta',
    },
    {
      regex: /"image"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/gi,
      source: 'source-page-meta',
    },
    {
      regex:
        /<(?:img|a)[^>]+(?:src|href|data-src|data-image|data-full|data-large-file)=["']([^"']+)["'][^>]*>/gi,
      source: 'source-page-html',
    },
  ];

  for (const { regex, source } of patterns) {
    for (const match of html.matchAll(regex)) {
      const raw = match[1]?.replace(/\\\//g, '/');
      pushCandidate(results, raw, source, meta, pageUrl);
    }
  }

  if (/collezionegalleriaborghese\.it/i.test(pageUrl)) {
    const borgheseInventory = padBorgheseInventory(meta.inventoryNumber);
    if (borgheseInventory) {
      pushCandidate(
        results,
        `https://www.collezionegalleriaborghese.it/uploads/server/files/${borgheseInventory}.jpg`,
        'source-page-borghese-direct',
        meta,
      );
    }
  }

  return [...results.values()].sort((a, b) => b.score - a.score);
}

function getSeedImageMap(): Map<string, ArtworkSourceMeta> {
  const map = new Map<string, ArtworkSourceMeta>();
  const seedFiles = ['seed-borghese.json', 'seed-uffizi.json'];

  for (const file of seedFiles) {
    const p = path.resolve(__dirname, file);
    const data = require(p) as {
      artworks?: Array<{
        wikidataId?: string;
        museumId?: string;
        title?: string;
        author?: string;
        image?: string;
        _extra?: { sourceUrl?: string; inventoryNumber?: string | null };
      }>;
    };
    for (const a of data.artworks ?? []) {
      const id = String(a.wikidataId ?? '').trim();
      if (!id) continue;

      map.set(id, {
        wikidataId: id,
        museumId: String(a.museumId ?? '').trim() || undefined,
        title: String(a.title ?? '').trim() || undefined,
        author: String(a.author ?? '').trim() || undefined,
        seedImage: normalizeHttpUrl(a.image) ?? undefined,
        sourceUrl: normalizeHttpUrl(a._extra?.sourceUrl) ?? undefined,
        inventoryNumber: a._extra?.inventoryNumber ?? null,
      });
    }
  }

  return map;
}

async function fetchTextWithRetries(url: string): Promise<string> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ArtAroundSeeder/1.0 (retry-missing-artwork-images)' },
        redirect: 'follow',
      });

      if (res.ok) {
        return await res.text();
      }

      if (res.status === 429 || res.status >= 500) {
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterSec = Number.parseInt(retryAfterHeader ?? '', 10);
        const backoff = Number.isFinite(retryAfterSec)
          ? retryAfterSec * 1000
          : Math.min(45_000, 1200 * attempt + Math.floor(Math.random() * 800));
        await sleep(backoff);
        continue;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await sleep(Math.min(45_000, 1200 * attempt + Math.floor(Math.random() * 800)));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr ?? new Error('html fetch failed');
}

async function getWikidataEntity(wikidataId: string): Promise<WikidataEntity> {
  const cached = wikidataEntityCache.get(wikidataId);
  if (cached) return cached;

  const jsonUrl = `https://www.wikidata.org/wiki/Special:EntityData/${wikidataId}.json`;
  const text = await fetchTextWithRetries(jsonUrl);
  const parsed = JSON.parse(text) as { entities?: Record<string, WikidataEntity> };
  const entity = parsed.entities?.[wikidataId] ?? {};
  wikidataEntityCache.set(wikidataId, entity);
  return entity;
}

async function getCommonsCandidatesFromWikidata(
  meta: ArtworkSourceMeta,
): Promise<CandidateImage[]> {
  const results = new Map<string, CandidateImage>();
  const entity = await getWikidataEntity(meta.wikidataId);

  for (const claim of entity?.claims?.P18 ?? []) {
    const fileName = String(claim?.mainsnak?.datavalue?.value ?? '').trim();
    if (!fileName) continue;
    pushCandidate(
      results,
      `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=1600`,
      'wikidata-p18',
      meta,
    );
  }

  const commonsTitle = String(entity?.sitelinks?.commonswiki?.title ?? '').trim();
  if (!commonsTitle) {
    return [...results.values()].sort((a, b) => b.score - a.score);
  }

  if (commonsTitle.startsWith('File:')) {
    pushCandidate(
      results,
      `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commonsTitle.slice(5))}?width=1600`,
      'wikidata-commons-file',
      meta,
    );
    return [...results.values()].sort((a, b) => b.score - a.score);
  }

  if (!commonsTitle.startsWith('Category:')) {
    return [...results.values()].sort((a, b) => b.score - a.score);
  }

  const params = new URLSearchParams({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: commonsTitle,
    gcmtype: 'file',
    gcmlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '1600',
    format: 'json',
    origin: '*',
  });

  const responseText = await fetchTextWithRetries(
    `https://commons.wikimedia.org/w/api.php?${params}`,
  );
  const data = JSON.parse(responseText) as { query?: { pages?: Record<string, CommonsApiPage> } };
  const pages = Object.values(data.query?.pages ?? {});

  for (const page of pages) {
    const imageInfo = page.imageinfo?.[0];
    const url = imageInfo?.thumburl ?? imageInfo?.url;
    if (!url) continue;
    pushCandidate(
      results,
      url,
      'wikidata-commons-category',
      { ...meta, title: page.title ?? meta.title },
      url,
    );
  }

  return [...results.values()].sort((a, b) => b.score - a.score);
}

async function getSourcePageCandidates(meta: ArtworkSourceMeta): Promise<CandidateImage[]> {
  if (!meta.sourceUrl) return [];
  const html = await fetchTextWithRetries(meta.sourceUrl);
  return extractHtmlImageCandidates(html, meta.sourceUrl, meta);
}

async function resolveArtworkCandidates(meta: ArtworkSourceMeta): Promise<CandidateImage[]> {
  const results = new Map<string, CandidateImage>();

  if (meta.seedImage) {
    pushCandidate(results, meta.seedImage, 'seed-image', meta);
  }

  try {
    for (const candidate of await getSourcePageCandidates(meta)) {
      const existing = results.get(candidate.url);
      if (!existing || candidate.score > existing.score) {
        results.set(candidate.url, candidate);
      }
    }
  } catch {
    // ignora i fallimenti di questa pagina e prosegue con i fallback Wikidata
  }

  try {
    for (const candidate of await getCommonsCandidatesFromWikidata(meta)) {
      const existing = results.get(candidate.url);
      if (!existing || candidate.score > existing.score) {
        results.set(candidate.url, candidate);
      }
    }
  } catch {
    // ignore Wikidata/Commons failures per artwork
  }

  return [...results.values()].sort((a, b) => b.score - a.score);
}

async function fetchBufferWithRetries(url: string): Promise<Buffer> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ArtAroundSeeder/1.0 (retry-missing-artwork-images)' },
        redirect: 'follow',
      });

      if (res.ok) {
        const ab = await res.arrayBuffer();
        return Buffer.from(ab);
      }

      if (res.status === 429 || res.status >= 500) {
        const retryAfterHeader = res.headers.get('retry-after');
        const retryAfterSec = Number.parseInt(retryAfterHeader ?? '', 10);
        const backoff = Number.isFinite(retryAfterSec)
          ? retryAfterSec * 1000
          : Math.min(45_000, 1200 * attempt + Math.floor(Math.random() * 800));
        await sleep(backoff);
        continue;
      }

      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) {
        await sleep(Math.min(45_000, 1200 * attempt + Math.floor(Math.random() * 800)));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr ?? new Error('download failed');
}

async function saveOptimized(
  imageBuffer: Buffer,
  wikidataId: string,
): Promise<{ path: string; size: number }> {
  let bestPath: string | null = null;
  let bestSize = Number.POSITIVE_INFINITY;

  for (const profile of IMAGE_OPTIMIZATION_PROFILES) {
    const saved = await UploadService.processAndSave(imageBuffer, `${wikidataId}.jpg`, 'artworks', {
      width: profile.width,
      fit: 'inside',
      quality: profile.quality,
      format: 'webp',
    });

    if (bestPath) {
      await UploadService.deleteFile(bestPath);
    }

    bestPath = saved.path;
    bestSize = saved.size;

    if (saved.size <= IMAGE_TARGET_MAX_BYTES) {
      break;
    }
  }

  if (!bestPath) throw new Error('save failed');
  return { path: bestPath, size: bestSize };
}

async function main(): Promise<void> {
  await connectDB();

  const sourceMap = getSeedImageMap();
  console.log(`🗺️  Metadati sorgente caricati: ${sourceMap.size}`);

  let totalRecovered = 0;

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    const missing = await ArtworkModel.find(
      { image: FALLBACK_ARTWORK_IMAGE },
      { _id: 0, wikidataId: 1, museumId: 1, title: 1 },
    ).lean<Array<{ wikidataId: string; museumId: string; title?: string }>>();

    console.log(`\n🔁 Pass ${pass}/${MAX_PASSES} — placeholder: ${missing.length}`);

    if (missing.length === 0) break;

    let recoveredThisPass = 0;

    for (let i = 0; i < missing.length; i++) {
      const artwork = missing[i];
      const meta = sourceMap.get(artwork.wikidataId) ?? {
        wikidataId: artwork.wikidataId,
        museumId: artwork.museumId,
        title: artwork.title,
      };
      const candidates = await resolveArtworkCandidates({
        ...meta,
        wikidataId: artwork.wikidataId,
        museumId: artwork.museumId,
        title: artwork.title || meta.title,
      });
      if (candidates.length === 0) {
        process.stdout.write(
          `   ⚪ [${i + 1}/${missing.length}] ${artwork.wikidataId}… nessuna sorgente\n`,
        );
        continue;
      }

      process.stdout.write(
        `   ⏳ [${i + 1}/${missing.length}] ${artwork.wikidataId}… ${candidates[0].source} (${candidates.length}) `,
      );

      let recovered = false;
      let lastError: string | null = null;

      for (const candidate of candidates) {
        try {
          const buffer = await fetchBufferWithRetries(candidate.url);
          const saved = await saveOptimized(buffer, artwork.wikidataId);

          await ArtworkModel.updateOne(
            { wikidataId: artwork.wikidataId, museumId: artwork.museumId },
            { $set: { image: saved.path, images: [saved.path] } },
          );

          await ItemModel.updateMany(
            { referenceId: artwork.wikidataId, museumId: artwork.museumId },
            { $set: { image: saved.path } },
          );

          recoveredThisPass++;
          totalRecovered++;
          recovered = true;
          process.stdout.write(
            `✅ ${saved.path} (${Math.round(saved.size / 1024)}KB) ← ${candidate.source}\n`,
          );
          break;
        } catch (err) {
          lastError = `${candidate.source}: ${(err as Error).message}`;
        }
      }

      if (!recovered) {
        process.stdout.write(`❌ ${lastError ?? 'nessun candidate valido'}\n`);
      }

      await sleep(BETWEEN_ARTWORKS_MS);
    }

    console.log(`   ➕ Recuperate nel pass ${pass}: ${recoveredThisPass}`);

    if (recoveredThisPass === 0) {
      console.log('   ⛔ Nessun progresso in questo pass, stop anticipato.');
      break;
    }
  }

  const remaining = await ArtworkModel.countDocuments({ image: FALLBACK_ARTWORK_IMAGE });
  console.log(
    `\n✅ Retry completato. Recuperate totali: ${totalRecovered}. Placeholder rimanenti: ${remaining}`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Retry immagini fallito:', err);
  process.exit(1);
});
