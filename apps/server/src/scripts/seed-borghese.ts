/**
 * seed-borghese.ts
 *
 * Seed script per Galleria Borghese — carica tutto da seed-borghese.json
 *
 * Uso:
 *   npx tsx src/scripts/seed-borghese.ts
 *
 * Il JSON contiene:
 *   - museum:   documento Museum completo (wikidataId, location, floors, services…)
 *   - rooms:    metadati delle 20 sale (non un modello MongoDB separato)
 *   - artworks: 84 opere con tutti i campi pronti per ArtworkModel
 *
 * Immagini:
 *   - Le opere con URL Wikimedia Commons vengono scaricate in /uploads/artworks/<wikidataId>.jpg
 *   - Le opere senza immagine vengono inserite con image: ""
 *   - Le immagini già scaricate vengono saltate (idempotente)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/database.js';
import { MuseumModel, ArtworkModel, ItemModel, User } from '../models/index.js';
import { AIService } from '../utils/ai.service.js';
import { UploadService } from '../utils/upload.service.js';
import {
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  LicenseType,
  UserRole,
} from '@artaround/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

// /uploads/ è nella root del progetto (../../../../ da apps/server/src/scripts/)
const UPLOADS_DIR = path.resolve(__dirname, '../../../../uploads');
const ARTWORKS_DIR = path.join(UPLOADS_DIR, 'artworks');

const seedFileName = getArgValue('--seed-file') ?? 'seed-borghese.json';
const cacheFileName =
  getArgValue('--cache-file') ?? `${seedFileName.replace(/\.json$/i, '')}.items-cache.v2.json`;

const ITEMS_CACHE_PATH = path.resolve(__dirname, cacheFileName);
const seedPath = path.resolve(__dirname, seedFileName);
const AI_ITEM_CONCURRENCY = 2;

const cliArgs = new Set(process.argv.slice(2));
const ITEMS_ONLY_MODE = cliArgs.has('--items-only') || cliArgs.has('--generate-items-only');
const REGENERATE_ITEMS_MODE = cliArgs.has('--regen-items') || cliArgs.has('--regenerate-items');

// ── Download immagini ─────────────────────────────────────────────────────────

const CONCURRENCY = 5;
const FALLBACK_ARTWORK_IMAGE = '/uploads/artworks/placeholder.png';
const DL_TIMEOUT_MS = 20_000;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Scarica un URL in un file locale. Se il file esiste già, skippa. Ritorna il path locale /uploads/artworks/<name>. */
async function downloadImage(remoteUrl: string, wikidataId: string): Promise<string> {
  let imageBuffer: Buffer | null = null;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DL_TIMEOUT_MS);
    try {
      const res = await fetch(remoteUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ArtAroundSeeder/1.0 (seed-borghese)' },
        redirect: 'follow',
      });
      lastStatus = res.status;
      if (!res.ok) {
        if (res.status === 429 && attempt < 4) {
          await sleep(600 * attempt);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!imageBuffer) {
    throw new Error(`HTTP ${lastStatus || 'download failed'}`);
  }

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

  if (!bestPath) {
    throw new Error('save failed');
  }

  if (bestSize > IMAGE_TARGET_MAX_BYTES) {
    console.warn(
      `   ⚠  ${wikidataId} — immagine oltre target (${Math.round(bestSize / 1024)}KB > 512KB)`,
    );
  }

  return bestPath;
}

function isLocalUploadPath(value: string | undefined): value is string {
  return !!value && value.startsWith('/uploads/') && value !== FALLBACK_ARTWORK_IMAGE;
}

async function cleanupLocalImagesForMuseum(museumId: string): Promise<void> {
  const [artworks, items] = await Promise.all([
    ArtworkModel.find({ museumId }, { image: 1, images: 1, _id: 0 }).lean<
      Array<{ image?: string; images?: string[] }>
    >(),
    ItemModel.find({ museumId }, { image: 1, _id: 0 }).lean<Array<{ image?: string }>>(),
  ]);

  const paths = new Set<string>();

  for (const artwork of artworks) {
    if (isLocalUploadPath(artwork.image)) {
      paths.add(artwork.image);
    }
    for (const img of artwork.images ?? []) {
      if (isLocalUploadPath(img)) {
        paths.add(img);
      }
    }
  }

  for (const item of items) {
    if (isLocalUploadPath(item.image)) {
      paths.add(item.image);
    }
  }

  let deleted = 0;
  for (const uploadPath of paths) {
    if (await UploadService.deleteFile(uploadPath)) {
      deleted++;
    }
  }

  console.log(`   🧹  Immagini locali rimosse: ${deleted}/${paths.size}`);
}

/** Esegue il download in parallelo con limite di concorrenza. */
async function downloadAllImages(artworks: SeedArtwork[]): Promise<Map<string, string>> {
  const result = new Map<string, string>(); // wikidataId → publicPath
  let done = 0;
  let skipped = 0;
  let failed = 0;

  // Chunk in gruppi da CONCURRENCY
  for (let i = 0; i < artworks.length; i += CONCURRENCY) {
    const batch = artworks.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (a) => {
        const url = a.image;
        if (!url || url.includes('No%20image')) {
          skipped++;
          return;
        }
        try {
          const localPath = await downloadImage(url, a.wikidataId);
          result.set(a.wikidataId, localPath);
          done++;
          process.stdout.write(`   ⬇  [${done}] ${a.wikidataId} → ${localPath}\n`);
        } catch (err) {
          failed++;
          console.warn(
            `   ⚠  ${a.wikidataId} (${a.title.slice(0, 40)}) — download fallito: ${(err as Error).message}`,
          );
        }
      }),
    );
  }

  console.log(
    `\n   ✅  Download completato: ${done} scaricate, ${skipped} senza img, ${failed} fallite\n`,
  );
  return result;
}

// ── Tipi locali ──────────────────────────────────────────────────────────────

interface SeedRoom {
  id: string;
  number: number;
  name: string;
  floorId: string;
  floor: string;
  description: string;
}

interface SeedArtwork {
  wikidataId: string;
  museumId: string;
  title: string;
  description?: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  startYear?: number;
  endYear?: number;
  artworkType: string;
  movement?: string;
  movementWikidataId?: string;
  dimensions?: {
    height?: number;
    width?: number;
    depth?: number;
    diameter?: number;
    unit: 'cm';
    displayText: string;
  };
  materials: string[];
  subjects: string[];
  image: string;
  images?: string[];
  room: string;
  floor: string;
  mapPosition: {
    floorId: string;
    x: number;
    y: number;
    rotation?: number;
  };
  _extra?: {
    sourceUrl?: string;
    inventoryNumber?: string;
    querySource?: string;
  };
}

interface SeedGeneratedItem {
  museumId: string;
  referenceType: ItemReferenceType;
  referenceId: string;
  referenceTitle: string;
  sourceLanguage: 'it';
  title: string;
  text: string;
  duration: ContentDuration;
  languageLevel: LanguageLevel;
  license: LicenseType;
  price: number;
  isFree: boolean;
  tags: string[];
  image?: string;
}

interface SeedDocument {
  _meta: {
    description: string;
    generatedAt: string;
    museumWikidataId: string;
    totalArtworks: number;
    floors: number;
    rooms: number;
    sources: string[];
    totalItems?: number;
  };
  museum: Record<string, unknown>;
  rooms: SeedRoom[];
  artworks: SeedArtwork[];
  items?: SeedGeneratedItem[];
}

type ItemsCache = Record<string, SeedGeneratedItem[]>;

type ItemLengthRule = {
  label: string;
  targetWords: number;
  targetChars: number;
  minWords: number;
  maxWords: number;
  minChars: number;
  maxChars: number;
};

type AITagResponse = {
  tags: string[];
};

let ACTIVE_MUSEUM_NAME = 'Galleria Borghese';

// ── Carica il JSON ────────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const seedData: SeedDocument = require(seedPath);
ACTIVE_MUSEUM_NAME =
  String((seedData.museum as { name?: string })?.name ?? 'Museo').trim() || 'Museo';

// ── Items (guide contenuto per ogni opera) ────────────────────────────────────

const ITEM_DURATIONS: ContentDuration[] = [
  ContentDuration.FLASH,
  ContentDuration.SHORT,
  ContentDuration.MEDIUM,
  ContentDuration.LONG,
];

const ITEM_LEVELS: LanguageLevel[] = [
  LanguageLevel.CHILDREN,
  LanguageLevel.ELEMENTARY,
  LanguageLevel.MEDIUM,
  LanguageLevel.SPECIALIST,
];

const ITALIAN_CENTURY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\btrecento\b/gi, '1300'],
  [/\bquattrocento\b/gi, '1400'],
  [/\bcinquecento\b/gi, '1500'],
  [/\bseicento\b/gi, '1600'],
  [/\bsettecento\b/gi, '1700'],
  [/\bottocento\b/gi, '1800'],
  [/\bnovecento\b/gi, '1900'],
];

const ITEM_LENGTH_RULES: Record<ContentDuration, ItemLengthRule> = {
  [ContentDuration.FLASH]: {
    label: '4 secondi',
    targetWords: 9,
    targetChars: 54,
    minWords: 6,
    maxWords: 16,
    minChars: 28,
    maxChars: 90,
  },
  [ContentDuration.SHORT]: {
    label: '15 secondi',
    targetWords: 36,
    targetChars: 198,
    minWords: 26,
    maxWords: 50,
    minChars: 150,
    maxChars: 280,
  },
  [ContentDuration.MEDIUM]: {
    label: '1 minuto',
    targetWords: 135,
    targetChars: 765,
    minWords: 110,
    maxWords: 170,
    minChars: 620,
    maxChars: 980,
  },
  [ContentDuration.LONG]: {
    label: '4 minuti',
    targetWords: 540,
    targetChars: 3150,
    minWords: 430,
    maxWords: 650,
    minChars: 2500,
    maxChars: 3800,
  },
  [ContentDuration.EXTENDED]: {
    label: '10 minuti',
    targetWords: 1200,
    targetChars: 7000,
    minWords: 950,
    maxWords: 1450,
    minChars: 5500,
    maxChars: 8500,
  },
};

function buildItemTitle(
  artworkTitle: string,
  duration: ContentDuration,
  level: LanguageLevel,
): string {
  return `${artworkTitle} — ${duration} — ${level}`;
}

const DISALLOWED_LOCATION_REGEX =
  /\b(?:museo|sala\s+[ivxlcdm\d]+|sala\b|piano\s+terra|primo\s+piano|secondo\s+piano|collezione)\b/i;
const WRITTEN_NUMBER_REGEX =
  /\b(?:due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti\w*|trenta\w*|quaranta\w*|cinquanta\w*|sessanta\w*|settanta\w*|ottanta\w*|novanta\w*|cento\w*|mille\w*|duemila\w*|trecento\w*|quattrocento\w*|cinquecento\w*|seicento\w*|settecento\w*|ottocento\w*|novecento\w*)\b/i;
const GENERIC_TAG_REGEX = /^(?:arte|museo|opera|opere|capolavoro|quadro|scultura)$/i;

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, ' ');
}

function validateAudioguideText(text: string, artworkTitle?: string): string | null {
  if (DISALLOWED_LOCATION_REGEX.test(text)) {
    return 'riferimento a museo/sala/piano non consentito';
  }
  if (
    ACTIVE_MUSEUM_NAME &&
    new RegExp(`\\b${escapeRegExp(ACTIVE_MUSEUM_NAME)}\\b`, 'i').test(text)
  ) {
    return 'riferimento al nome del museo non consentito';
  }
  const textForNumbers = artworkTitle
    ? text.replace(new RegExp(escapeRegExp(artworkTitle), 'gi'), ' ')
    : text;
  if (WRITTEN_NUMBER_REGEX.test(textForNumbers)) {
    return 'numeri scritti in lettere non consentiti';
  }
  return null;
}

function validateTagSet(tags: string[]): string | null {
  if (tags.length < 6 || tags.length > 12) {
    return `numero tag non valido: ${tags.length}`;
  }
  if (new Set(tags).size !== tags.length) {
    return 'tag duplicati';
  }
  if (tags.some((tag) => tag.length < 2 || tag.length > 40)) {
    return 'lunghezza tag non valida';
  }
  if (tags.some((tag) => GENERIC_TAG_REGEX.test(tag))) {
    return 'presenti tag troppo generici';
  }
  return null;
}

async function generateTagsForArtworkWithAI(a: SeedArtwork): Promise<string[]> {
  const systemInstruction = [
    'Sei un catalogatore editoriale per contenuti museali.',
    'Genera tag in italiano, utili per ricerca e classificazione.',
    'I tag devono essere specifici, brevi, in minuscolo, senza hashtag.',
    'Niente tag generici come arte, museo, opera, quadro, scultura, capolavoro.',
    'Niente nome del museo nei tag.',
    'Usa numeri in cifre quando servono.',
    'Restituisci JSON con forma {"tags":[...]} e nient’altro.',
  ].join('\n');

  const userPrompt = [
    `Opera: ${a.title}`,
    `Autore: ${a.author || 'sconosciuto'}`,
    `Museo di collocazione: ${ACTIVE_MUSEUM_NAME} (solo per disambiguazione, non usarlo nei tag).`,
    `Tipo opera: ${a.artworkType}`,
    a.movement ? `Movimento/Stile: ${a.movement}` : '',
    a.materials?.length ? `Materiali/Tecnica: ${a.materials.join(', ')}` : '',
    a.year ? `Anno: ${a.year}` : '',
    a.description && a.description !== 'Scheda in compilazione.'
      ? `Descrizione: ${a.description}`
      : '',
    'Genera 8 tag specifici e utili per catalogazione e ricerca.',
  ]
    .filter(Boolean)
    .join('\n');

  let lastIssue = 'nessun tag generato';
  let previousTags: string[] = [];

  for (let attempt = 1; attempt <= 6; attempt++) {
    const prompt =
      attempt === 1
        ? userPrompt
        : [
            userPrompt,
            `La proposta precedente non è valida: ${lastIssue}.`,
            previousTags.length ? `Tag precedenti da correggere: ${previousTags.join(', ')}.` : '',
            'Genera esattamente 8 tag nuovi, specifici e non generici.',
            'Evita parole vuote come arte, museo, opera, quadro, scultura, capolavoro.',
            'Non usare il nome del museo.',
          ]
            .filter(Boolean)
            .join('\n\n');

    const response = await AIService.generateJson<AITagResponse>(systemInstruction, prompt, {
      temperature: 0.2,
      maxTokens: 300,
    });

    const tags = Array.from(new Set((response.tags ?? []).map(normalizeTag).filter(Boolean)));
    const issue = validateTagSet(tags);
    if (!issue) {
      return tags;
    }

    previousTags = tags;
    lastIssue = issue;
  }

  throw new Error(`${a.title} → tag non validi: ${lastIssue}`);
}

function expectedItemsCountForArtwork(): number {
  return ITEM_DURATIONS.length * ITEM_LEVELS.length;
}

function hasValidItemMatrix(
  items: SeedGeneratedItem[] | undefined,
  artworkId?: string,
): items is SeedGeneratedItem[] {
  if (!items || items.length !== expectedItemsCountForArtwork()) return false;

  const combos = new Set(items.map((item) => `${item.duration}|${item.languageLevel}`));
  if (combos.size !== expectedItemsCountForArtwork()) return false;

  if (artworkId && items.some((item) => item.referenceId !== artworkId)) return false;

  return true;
}

function hasValidLengthsMatrix(
  items: SeedGeneratedItem[] | undefined,
): items is SeedGeneratedItem[] {
  if (!items) return false;
  return items.every(
    (item) => !validateItemLength(item) && !validateAudioguideText(item.text, item.referenceTitle),
  );
}

function normalizeSpokenText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function validateItemLength(
  item: Pick<SeedGeneratedItem, 'duration' | 'languageLevel' | 'text'>,
): string | null {
  const rule = ITEM_LENGTH_RULES[item.duration];
  const words = countWords(item.text);
  const chars = item.text.length;

  if (words < rule.minWords || words > rule.maxWords) {
    return `${item.duration}/${item.languageLevel}: parole ${words} fuori range ${rule.minWords}-${rule.maxWords}`;
  }
  if (chars < rule.minChars || chars > rule.maxChars) {
    return `${item.duration}/${item.languageLevel}: caratteri ${chars} fuori range ${rule.minChars}-${rule.maxChars}`;
  }
  return null;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function numberToItalianWords(n: number): string {
  const units = [
    'zero',
    'uno',
    'due',
    'tre',
    'quattro',
    'cinque',
    'sei',
    'sette',
    'otto',
    'nove',
    'dieci',
    'undici',
    'dodici',
    'tredici',
    'quattordici',
    'quindici',
    'sedici',
    'diciassette',
    'diciotto',
    'diciannove',
  ];
  const tens = [
    '',
    '',
    'venti',
    'trenta',
    'quaranta',
    'cinquanta',
    'sessanta',
    'settanta',
    'ottanta',
    'novanta',
  ];

  if (n < 20) return units[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    let base = tens[ten];
    if (unit === 1 || unit === 8) base = base.slice(0, -1);
    return base + (unit ? units[unit] : '');
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let base = hundred === 1 ? 'cento' : `${units[hundred]}cento`;
    if (rest >= 80 && rest < 90) base = base.slice(0, -1);
    return base + (rest ? numberToItalianWords(rest) : '');
  }
  if (n < 2000) {
    return `mille${n % 1000 ? numberToItalianWords(n % 1000) : ''}`;
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const thousandsPart = thousands === 1 ? 'mille' : `${numberToItalianWords(thousands)}mila`;
    return thousandsPart + (rest ? numberToItalianWords(rest) : '');
  }
  return String(n);
}

function numberToItalianParts(n: number): string[] {
  const units = [
    'zero',
    'uno',
    'due',
    'tre',
    'quattro',
    'cinque',
    'sei',
    'sette',
    'otto',
    'nove',
    'dieci',
    'undici',
    'dodici',
    'tredici',
    'quattordici',
    'quindici',
    'sedici',
    'diciassette',
    'diciotto',
    'diciannove',
  ];
  const tens = [
    '',
    '',
    'venti',
    'trenta',
    'quaranta',
    'cinquanta',
    'sessanta',
    'settanta',
    'ottanta',
    'novanta',
  ];

  if (n < 20) return [units[n]];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return unit ? [tens[ten], units[unit]] : [tens[ten]];
  }
  if (n < 1000) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    const head = hundred === 1 ? 'cento' : `${units[hundred]}cento`;
    return rest ? [head, ...numberToItalianParts(rest)] : [head];
  }
  if (n < 2000) {
    return n % 1000 ? ['mille', ...numberToItalianParts(n % 1000)] : ['mille'];
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head = thousands === 1 ? 'mille' : `${numberToItalianWords(thousands)}mila`;
    return rest ? [head, ...numberToItalianParts(rest)] : [head];
  }
  return [String(n)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLooseItalianNumberPattern(n: number): string {
  const compact = numberToItalianWords(n);
  const separated = numberToItalianParts(n).map(escapeRegExp).join('\\s*');
  if (n < 1000) return escapeRegExp(compact);

  if (n < 2000) {
    const rest = n % 1000;
    if (!rest) return escapeRegExp('mille');
    const hundreds = Math.floor(rest / 100) * 100;
    const last = rest % 100;
    const head = `mille${hundreds ? numberToItalianWords(hundreds) : ''}`;
    if (!last) return escapeRegExp(head);
    const compactPattern = `${escapeRegExp(head)}(?:\\s*e)?\\s*${escapeRegExp(numberToItalianWords(last))}`;
    return `(?:${compactPattern}|${separated})`;
  }

  return `(?:${escapeRegExp(compact)}|${separated})`;
}

function normalizeYearToDigits(a: SeedArtwork, text: string): string {
  if (!a.year || !/^\d{3,4}$/.test(a.year)) return text;

  const yearNum = Number(a.year);
  const centuryNum = Math.floor(yearNum / 100) * 100;
  const yearPattern = buildLooseItalianNumberPattern(yearNum);
  const centuryPattern = buildLooseItalianNumberPattern(centuryNum);

  let result = text;
  result = result.replace(new RegExp(`\\banno\\s+${yearPattern}\\b`, 'gi'), `anno ${a.year}`);
  result = result.replace(new RegExp(`\\bnel\\s+${yearPattern}\\b`, 'gi'), `nel ${a.year}`);
  result = result.replace(new RegExp(`\\bdel\\s+${yearPattern}\\b`, 'gi'), `del ${a.year}`);
  result = result.replace(new RegExp(`\\b${yearPattern}\\b`, 'gi'), a.year);

  if (centuryNum !== yearNum) {
    result = result.replace(
      new RegExp(`\\banno\\s+${centuryPattern}\\b`, 'gi'),
      `anno ${centuryNum}`,
    );
    result = result.replace(
      new RegExp(`\\bnel\\s+${centuryPattern}\\b`, 'gi'),
      `nel ${centuryNum}`,
    );
    result = result.replace(
      new RegExp(`\\bdel\\s+${centuryPattern}\\b`, 'gi'),
      `del ${centuryNum}`,
    );
    result = result.replace(new RegExp(`\\b${centuryPattern}\\b`, 'gi'), String(centuryNum));
  }

  return result;
}

function normalizeKnownNumbersToDigits(a: SeedArtwork, text: string): string {
  const knownNumbers = new Set<number>();
  if (a.year && /^\d+$/.test(a.year)) knownNumbers.add(Number(a.year));
  if (typeof a.startYear === 'number') knownNumbers.add(a.startYear);
  if (typeof a.endYear === 'number') knownNumbers.add(a.endYear);
  if (typeof a.dimensions?.height === 'number') knownNumbers.add(Math.round(a.dimensions.height));
  if (typeof a.dimensions?.width === 'number') knownNumbers.add(Math.round(a.dimensions.width));
  if (typeof a.dimensions?.depth === 'number') knownNumbers.add(Math.round(a.dimensions.depth));
  if (typeof a.dimensions?.diameter === 'number')
    knownNumbers.add(Math.round(a.dimensions.diameter));

  let result = text;
  for (const value of knownNumbers) {
    const pattern = buildLooseItalianNumberPattern(value);
    result = result.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), String(value));
  }

  return result;
}

function normalizeCommonItalianNumbersToDigits(text: string): string {
  let result = text;

  for (const [pattern, replacement] of ITALIAN_CENTURY_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  for (let value = 300; value >= 2; value--) {
    const pattern = buildLooseItalianNumberPattern(value);
    result = result.replace(new RegExp(`\\b${pattern}\\b`, 'gi'), String(value));
  }

  return result;
}

function stripLocationSentences(text: string): string {
  let result = text;
  result = result.replace(
    /\b(?:alla|nella|presso)\s+galleria\s+borghese\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = result.replace(/\b(?:nel|nella|al|alla|in)\s+museo\b[^,.!?;:]*(?:[,;:]\s*)?/gi, ' ');
  result = result.replace(
    /\b(?:si\s+trova|è\s+esposta|è\s+collocata|si\s+trova\s+collocata)\s+(?:nella|nel|alla|al|in)\s+sala\s+[ivxlcdm\d]+\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = result.replace(
    /\b(?:nella|nel|alla|al|in)\s+sala\s+[ivxlcdm\d]+\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = result.replace(
    /\b(?:nel|nella|al|alla|in)\s+(?:primo|secondo)\s+piano\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = result.replace(
    /\b(?:dedicata|dedicato)\s+a\s+caravaggio\s+e\s+al\s+seicento\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = splitSentences(result)
    .filter((sentence) => !DISALLOWED_LOCATION_REGEX.test(sentence))
    .join(' ')
    .trim();
  return normalizeSpokenText(result);
}

function trimToMax(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const sentences = splitSentences(text);
  let acc = '';
  for (const sentence of sentences) {
    const next = acc ? `${acc} ${sentence}` : sentence;
    if (next.length > maxChars) break;
    acc = next;
  }
  if (acc) return acc;

  const sliced = text.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  return (
    (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim().replace(/[,:;\-–—\s]+$/u, '') + '.'
  );
}

function coerceTextToLength(
  a: SeedArtwork,
  duration: ContentDuration,
  level: LanguageLevel,
  text: string,
): string {
  const rule = ITEM_LENGTH_RULES[duration];
  let result = normalizeSpokenText(text);
  result = stripLocationSentences(result);
  result = normalizeYearToDigits(a, result);
  result = normalizeKnownNumbersToDigits(a, result);
  result = normalizeCommonItalianNumbersToDigits(result);

  if (result.length > rule.maxChars) {
    result = trimToMax(result, rule.maxChars);
  }

  if (result.length > rule.maxChars) {
    result = trimToMax(result, rule.maxChars);
  }

  result = normalizeSpokenText(result);
  result = stripLocationSentences(result);
  result = normalizeYearToDigits(a, result);
  result = normalizeKnownNumbersToDigits(a, result);
  result = normalizeCommonItalianNumbersToDigits(result);
  return result;
}

function audienceDescription(level: LanguageLevel): string {
  switch (level) {
    case LanguageLevel.CHILDREN:
      return 'bambino di 6 anni';
    case LanguageLevel.ELEMENTARY:
      return 'ragazzo delle scuole medie';
    case LanguageLevel.MEDIUM:
      return 'ragazzo del liceo o visitatore medio';
    case LanguageLevel.SPECIALIST:
      return 'critico d’arte o visitatore molto qualificato';
    default:
      return 'visitatore';
  }
}

function buildArtworkPrompt(a: SeedArtwork): string {
  const dimensionsText = a.dimensions?.displayText
    ? `Dimensioni: ${a.dimensions.displayText}.`
    : '';
  const materialsText = a.materials?.length ? `Materiali/Tecnica: ${a.materials.join(', ')}.` : '';
  const movementText = a.movement ? `Movimento/Stile: ${a.movement}.` : '';
  const yearText = a.year ? `Datazione: ${a.year}.` : '';
  const authorText = a.author ? `Autore: ${a.author}.` : 'Autore: sconosciuto.';

  return [
    `Opera: ${a.title}`,
    authorText,
    `Museo di collocazione: ${ACTIVE_MUSEUM_NAME} (solo per disambiguazione tra opere simili; non citarlo nel testo finale).`,
    yearText,
    `Tipo opera: ${a.artworkType}.`,
    movementText,
    dimensionsText,
    materialsText,
    `Descrizione di base: ${a.description && a.description !== 'Scheda in compilazione.' ? a.description : 'Non disponibile.'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateItemsForArtworkWithAI(a: SeedArtwork): Promise<SeedGeneratedItem[]> {
  const tags = await generateTagsForArtworkWithAI(a);
  const items: SeedGeneratedItem[] = [];

  for (const duration of ITEM_DURATIONS) {
    for (const languageLevel of ITEM_LEVELS) {
      const rule = ITEM_LENGTH_RULES[duration];
      const systemInstruction = [
        'Sei un autore professionista di audioguide museali in italiano.',
        'Scrivi un solo testo continuo, pensato per essere ascoltato da una persona che si trova davanti all’opera.',
        'Il testo deve comportarsi come una vera audioguida: puoi usare formule come “davanti a te”, “puoi notare”, “osserva”, ma non devi parlare del museo, della sala, del piano o della collocazione.',
        'Niente elenchi, niente markdown, niente link, niente URL, niente riferimenti a schede o siti esterni.',
        'Usa solo le informazioni fornite. Se un dato manca, omettilo. Non inventare dettagli.',
        'Tutti i numeri devono essere scritti in cifre: anni, misure, quantità, secoli, conteggi.',
        'Se il titolo dell’opera contiene numeri scritti in lettere, non ripeterlo integralmente: usa “l’opera”, “il dipinto” o “la scultura”.',
        `Pubblico di riferimento: ${audienceDescription(languageLevel)}.`,
        `Livello linguistico richiesto: ${languageLevel}.`,
        `Durata richiesta: ${duration}, da trattare come ${rule.label}.`,
        `Vincolo parole: tra ${rule.minWords} e ${rule.maxWords}, target ${rule.targetWords}.`,
        `Vincolo caratteri spazi inclusi: tra ${rule.minChars} e ${rule.maxChars}, target ${rule.targetChars}.`,
        'Resta dentro entrambi i range. È obbligatorio.',
        `Non citare mai ${ACTIVE_MUSEUM_NAME}, museo, sala, piano o posizione dell’opera nel percorso.`,
        'Rispondi solo con il testo finale, senza virgolette e senza commenti.',
      ].join('\n');

      const userPrompt = `${buildArtworkPrompt(a)}\n\nGenera adesso un solo testo per ${duration} e livello ${languageLevel}.`;

      let finalText = '';
      let lastIssue = 'nessun testo generato';
      let previousDraft = '';

      for (let attempt = 1; attempt <= 8; attempt++) {
        const previousWords = previousDraft ? countWords(previousDraft) : 0;
        const previousChars = previousDraft.length;
        const tooShort =
          previousDraft && (previousWords < rule.minWords || previousChars < rule.minChars);
        const tooLong =
          previousDraft && (previousWords > rule.maxWords || previousChars > rule.maxChars);

        const retryHint =
          attempt === 1
            ? userPrompt
            : [
                buildArtworkPrompt(a),
                `Testo precedente fuori vincolo: ${lastIssue}.`,
                `Conteggio attuale: ${previousWords} parole, ${previousChars} caratteri.`,
                `Obiettivo obbligatorio: tra ${rule.minWords} e ${rule.maxWords} parole e tra ${rule.minChars} e ${rule.maxChars} caratteri.`,
                tooShort
                  ? 'Il testo è troppo breve. Devi espanderlo in modo sostanziale, aggiungendo osservazioni visive, tecnica, composizione, gesto, luce, materia e significato, senza ripetizioni inutili e senza inventare dati.'
                  : tooLong
                    ? 'Il testo è troppo lungo. Devi comprimerlo molto, eliminando ripetizioni e dettagli secondari, ma mantenendo chiarezza e naturalezza.'
                    : 'Il testo è fuori vincolo: riscrivilo correggendo esattamente lunghezza e forma finale.',
                'Mantieni il registro di una vera audioguida ascoltata davanti all’opera.',
                'Non citare mai museo, sala, piano, collocazione o percorso.',
                'Tutti i numeri devono restare in cifre.',
                'Restituisci solo il nuovo testo completo finale.',
                'Testo da correggere:',
                previousDraft,
              ].join('\n\n');

        const raw = await AIService.createChatCompletion(
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: retryHint },
          ],
          {
            temperature: 0.2,
            maxTokens:
              duration === ContentDuration.FLASH
                ? 70
                : duration === ContentDuration.SHORT
                  ? 220
                  : duration === ContentDuration.MEDIUM
                    ? 900
                    : duration === ContentDuration.LONG
                      ? 4200
                      : 7000,
          },
        );

        finalText = coerceTextToLength(a, duration, languageLevel, raw);
        previousDraft = finalText;
        const issue =
          validateItemLength({ duration, languageLevel, text: finalText }) ??
          validateAudioguideText(finalText, a.title);
        if (!issue) {
          lastIssue = '';
          break;
        }
        lastIssue = issue;
      }

      if (lastIssue) {
        throw new Error(`${a.title} → ${lastIssue}`);
      }

      items.push({
        museumId: a.museumId,
        referenceType: ItemReferenceType.ARTWORK,
        referenceId: a.wikidataId,
        referenceTitle: a.title,
        sourceLanguage: 'it',
        title: buildItemTitle(a.title, duration, languageLevel),
        text: finalText,
        duration,
        languageLevel,
        license: LicenseType.CC0,
        price: 0,
        isFree: true,
        tags,
      });
    }
  }

  return items;
}

async function loadItemsCache(): Promise<ItemsCache> {
  try {
    const raw = await fs.promises.readFile(ITEMS_CACHE_PATH, 'utf8');
    return JSON.parse(raw) as ItemsCache;
  } catch {
    return {};
  }
}

async function saveItemsCache(cache: ItemsCache): Promise<void> {
  await fs.promises.writeFile(ITEMS_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

async function persistSeedDocument(updatedSeed: SeedDocument): Promise<void> {
  await fs.promises.writeFile(seedPath, JSON.stringify(updatedSeed, null, 2), 'utf8');
}

async function loadOrGenerateAllItems(seed: SeedDocument): Promise<SeedGeneratedItem[]> {
  const expectedTotal = seed.artworks.length * expectedItemsCountForArtwork();

  if (!REGENERATE_ITEMS_MODE && seed.items && seed.items.length === expectedTotal) {
    return seed.items;
  }

  AIService.assertConfigured();

  const cache = await loadItemsCache();
  const generatedByArtwork = new Map<string, SeedGeneratedItem[]>();

  for (const artwork of seed.artworks) {
    const cachedItems = cache[artwork.wikidataId];
    const usableCache =
      hasValidItemMatrix(cachedItems, artwork.wikidataId) && hasValidLengthsMatrix(cachedItems);

    if ((!REGENERATE_ITEMS_MODE && usableCache) || (REGENERATE_ITEMS_MODE && usableCache)) {
      generatedByArtwork.set(artwork.wikidataId, cache[artwork.wikidataId]);
    }
  }

  console.log(
    `📝  Generazione AI items: ${generatedByArtwork.size}/${seed.artworks.length} opere già in cache`,
  );
  if (REGENERATE_ITEMS_MODE) {
    console.log('   ♻️  Modalità rigenerazione forzata attiva');
  }

  for (let i = 0; i < seed.artworks.length; i += AI_ITEM_CONCURRENCY) {
    const batch = seed.artworks
      .slice(i, i + AI_ITEM_CONCURRENCY)
      .filter((artwork) => !generatedByArtwork.has(artwork.wikidataId));
    if (!batch.length) continue;

    await Promise.all(
      batch.map(async (artwork) => {
        process.stdout.write(`   🤖  [${i + 1}/${seed.artworks.length}] ${artwork.title}… `);
        const items = await generateItemsForArtworkWithAI(artwork);
        generatedByArtwork.set(artwork.wikidataId, items);
        cache[artwork.wikidataId] = items;
        await saveItemsCache(cache);
        process.stdout.write('OK\n');
      }),
    );
  }

  const allItems = seed.artworks.flatMap(
    (artwork) => generatedByArtwork.get(artwork.wikidataId) ?? [],
  );
  if (allItems.length !== expectedTotal) {
    throw new Error(`Items incompleti: ${allItems.length}/${expectedTotal}`);
  }

  seed.items = allItems;
  seed._meta.totalItems = allItems.length;
  await persistSeedDocument(seed);

  console.log(`✅  JSON aggiornato con ${allItems.length} items: ${seedPath}\n`);
  return allItems;
}

function buildItemsForInsert(
  items: SeedGeneratedItem[],
  authorId: string,
  imageMap: Map<string, string>,
): Record<string, unknown>[] {
  return items.map((item) => ({
    ...item,
    authorId,
    image: imageMap.get(item.referenceId) ?? FALLBACK_ARTWORK_IMAGE,
  }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🏛️  Seed ${ACTIVE_MUSEUM_NAME}\n`);
  console.log(`📄  Fonte: ${seedPath}`);
  console.log(
    `📊  Meta: ${seedData._meta.totalArtworks} opere, ${seedData._meta.rooms} sale, ${seedData._meta.floors} piani\n`,
  );

  const generatedItems = await loadOrGenerateAllItems(seedData);
  console.log(`🧠  Items disponibili nel JSON: ${generatedItems.length}\n`);

  if (ITEMS_ONLY_MODE) {
    console.log('✅  Modalità items-only completata. Nessun dato DB modificato.');
    process.exit(0);
  }

  await connectDB();

  // ── 1. Cancella dati esistenti ─────────────────────────────────────────────
  console.log('🗑️  Pulizia collezioni esistenti…');
  await cleanupLocalImagesForMuseum(seedData._meta.museumWikidataId);
  await Promise.all([
    MuseumModel.deleteMany({ wikidataId: seedData._meta.museumWikidataId }),
    ArtworkModel.deleteMany({ museumId: seedData._meta.museumWikidataId }),
    ItemModel.deleteMany({ museumId: seedData._meta.museumWikidataId }),
  ]);
  console.log('   ✅  Dati esistenti rimossi\n');

  // ── 2. Trova o crea l'utente autore ───────────────────────────────────────
  console.log('👤  Ricerca utente autore…');
  let author = await User.findOne({ role: UserRole.ADMIN });
  if (!author) {
    author = await User.findOne({ role: UserRole.AUTHOR });
  }
  if (!author) {
    const hashed = await bcrypt.hash('12345678', 10);
    const seedUserBase =
      ACTIVE_MUSEUM_NAME.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 30) || 'museum';
    const seedUser = `seed-${seedUserBase}`;
    author = await User.create({
      username: seedUser,
      email: `${seedUser}@artaround.app`,
      password: hashed,
      role: UserRole.AUTHOR,
      isActive: true,
    });
    console.log(`   ℹ️  Nessun utente trovato — creato utente ${seedUser}\n`);
  } else {
    console.log(`   ✅  Autore: ${author.username} (${author._id})\n`);
  }
  const authorId = author._id.toString();

  // ── 3. Crea il museo ───────────────────────────────────────────────────────
  console.log('🏛️  Creazione museo…');
  const museum = await MuseumModel.create(seedData.museum);
  console.log(`   ✅  Museo creato: ${museum.name} (${museum.wikidataId})`);
  console.log(`       Piani: ${museum.floors?.length ?? 0}`);
  console.log(
    `       Coordinate: ${museum.location.coordinates?.lat}, ${museum.location.coordinates?.lng}\n`,
  );

  // ── 4. Download immagini ────────────────────────────────────────────────────
  console.log(`🖼️  Download immagini in ${ARTWORKS_DIR}…`);
  console.log('   (Le immagini già presenti vengono saltate)\n');
  const imageMap = await downloadAllImages(seedData.artworks);

  // ── 5. Crea le opere ───────────────────────────────────────────────────────
  console.log(`🖼️  Creazione ${seedData.artworks.length} opere…`);

  const artworksPayload = seedData.artworks.map((a) => {
    const localImage = imageMap.get(a.wikidataId) ?? '';
    const effectiveImage = localImage || FALLBACK_ARTWORK_IMAGE;

    return {
      wikidataId: a.wikidataId,
      museumId: a.museumId,
      title: a.title,
      description: a.description ?? 'Scheda in compilazione.',
      author: a.author ?? 'Autore sconosciuto',
      authorWikidataId: a.authorWikidataId ?? undefined,
      year: a.year ?? undefined,
      startYear: a.startYear ?? undefined,
      endYear: a.endYear ?? undefined,
      artworkType: a.artworkType,
      movement: a.movement ?? undefined,
      movementWikidataId: a.movementWikidataId ?? undefined,
      dimensions: a.dimensions ?? undefined,
      materials: a.materials ?? [],
      subjects: a.subjects ?? [],
      image: effectiveImage,
      images: [effectiveImage],
      room: a.room,
      floor: a.floor,
      mapPosition: a.mapPosition,
    };
  });

  const created = await ArtworkModel.insertMany(artworksPayload, { ordered: false });
  console.log(`   ✅  Opere inserite: ${created.length}\n`);

  // ── 6. Crea gli items (16 per opera: 4 durate × 4 livelli) ───────────────
  console.log('📝  Inserimento content items (16 per opera)…');
  const itemsPayload = buildItemsForInsert(generatedItems, authorId, imageMap);
  await ItemModel.insertMany(itemsPayload, { ordered: false });
  console.log(
    `   ✅  Items inseriti: ${itemsPayload.length} (${seedData.artworks.length} opere × 16 combinazioni)\n`,
  );

  // ── 7. Riepilogo sale ──────────────────────────────────────────────────────
  console.log('📋  Distribuzione opere per sala:');
  const perSala = new Map<string, number>();
  for (const a of artworksPayload) {
    perSala.set(a.room, (perSala.get(a.room) ?? 0) + 1);
  }
  for (const [sala, count] of [...perSala.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`   ${String(count).padStart(2)}  ${sala}`);
  }

  console.log('\n✅  Seed completato con successo!');
  console.log(`    Museo:     ${museum.name}`);
  console.log(`    Opere:     ${created.length}`);
  console.log(`    Items:     ${itemsPayload.length} (4 durate × 4 linguaggi per ogni opera)`);
  console.log(`    Immagini:  ${imageMap.size} scaricate in ${ARTWORKS_DIR}`);
  console.log(
    `    Sale:      ${seedData.rooms.length} (metadati in ${path.basename(seedPath)} → rooms)`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error('❌  Seed fallito:', err);
  process.exit(1);
});
