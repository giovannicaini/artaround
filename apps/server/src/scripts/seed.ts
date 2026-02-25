import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/database.js';
import { User, MuseumModel, ArtworkModel, ItemModel, VisitModel } from '../models/index.js';
import {
  UserRole,
  CompetenceLevel,
  ContentDuration,
  LicenseType,
  TimePreference,
  ItemReferenceType,
  LanguageLevel,
  VisitStepType,
  ArtworkType,
} from '@artaround/shared';

/**
 * Seed script for ArtAround database — Galleria Borghese
 *
 * ✅ Improvements vs previous seed:
 * - Uses the *real* Wikidata item for the museum: Galleria Borghese = Q841506
 * - Imports artworks dynamically from Wikidata (WDQS SPARQL):
 *   - paintings + sculptures + other artworks that have:
 *     - collection (P195) = Galleria Borghese OR location (P276) = Galleria Borghese
 * - Generates valid image URLs (Wikimedia Commons thumbnails) with width=600 (usually < 1MB)
 * - Auto-generates a lot of content items (short/medium/long + language levels)
 * - Auto-generates sample visits (themes + steps)
 *
 * Notes:
 * - Room/floor/map positions are not available on Wikidata → generated deterministically from QID
 * - Some properties are missing on Wikidata for some works → we keep fields optional/fallback
 */

type WDQSBinding = Record<string, { type: string; value: string }>;
type WDQSJson = { results: { bindings: WDQSBinding[] } };

const MUSEUM_QID = 'Q841506'; // Galleria Borghese (real item)
const WDQS_ENDPOINT = 'https://query.wikidata.org/sparql';

function qidFromEntityUri(uri: string): string {
  // https://www.wikidata.org/entity/Q123 -> Q123
  const m = uri.match(/Q\d+$/);
  return m?.[0] ?? uri;
}

function decodeCommonsFileName(urlOrFile: string): string | null {
  // WDQS returns something like: https://commons.wikimedia.org/wiki/Special:FilePath/Foo%20Bar.jpg
  // or: https://upload.wikimedia.org/wikipedia/commons/...
  // We want the filename (with spaces) to use Special:FilePath.
  if (!urlOrFile) return null;
  const s = urlOrFile.trim();
  const fileMatch =
    s.match(/Special:FilePath\/(.+)$/i) ||
    s.match(/File:(.+)$/i) ||
    s.match(/upload\.wikimedia\.org\/wikipedia\/commons\/.+\/(.+)$/i);
  if (!fileMatch) return null;

  // strip querystring
  const raw = fileMatch[1].split('?')[0];
  try {
    return decodeURIComponent(raw).replace(/_/g, ' ');
  } catch {
    return raw.replace(/_/g, ' ');
  }
}

function commonsThumbUrl(image: string | null | undefined, width = 600): string | null {
  const fileName = image ? decodeCommonsFileName(image) : null;
  if (!fileName) return null;

  // Redirects to a thumbnail of the specified width (keeps bandwidth low)
  const encoded = encodeURIComponent(fileName).replace(/%2F/g, '/');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
}

function stableHash01(input: string): number {
  // deterministic hash in [0,1)
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unsigned 32-bit
  const u = h >>> 0;
  return u / 4294967296;
}

function mapArtworkType(typeQid: string | undefined, typeLabel: string | undefined): ArtworkType {
  const q = (typeQid ?? '').toUpperCase();
  const t = (typeLabel ?? '').toLowerCase();

  // Prefer exact Wikidata "instance of" QIDs when available
  // painting (Q3305213), sculpture (Q860861), fresco (Q22669139), mosaic (Q133067),
  // drawing (Q93184), print (Q11060274), relief sculpture (Q245117),
  // installation artwork (Q20437094), decorative art (Q631931), tapestry (Q19705453)
  if (q === 'Q3305213') return ArtworkType.PAINTING;
  if (q === 'Q860861') return ArtworkType.SCULPTURE;
  if (q === 'Q22669139') return ArtworkType.FRESCO;
  if (q === 'Q133067') return ArtworkType.MOSAIC;
  if (q === 'Q93184') return ArtworkType.DRAWING;
  if (q === 'Q11060274') return ArtworkType.PRINT;
  if (q === 'Q245117') return ArtworkType.RELIEF;
  if (q === 'Q20437094' || q === 'Q212431') return ArtworkType.INSTALLATION; // artwork or genre
  if (q === 'Q631931') return ArtworkType.DECORATIVE;
  if (q === 'Q19705453') return ArtworkType.TAPESTRY;

  // Fallback to label heuristics (covers cases where P31 is too generic or missing)
  // Most common first
  if (
    t.includes('painting') ||
    t.includes('dipinto') ||
    t.includes('oil on canvas') ||
    t.includes('tempera')
  )
    return ArtworkType.PAINTING;
  if (
    t.includes('sculpture') ||
    t.includes('scultura') ||
    t.includes('statue') ||
    t.includes('bust') ||
    t.includes('marble')
  )
    return ArtworkType.SCULPTURE;

  if (t.includes('fresco') || t.includes('affresco')) return ArtworkType.FRESCO;
  if (t.includes('mosaic') || t.includes('mosaico')) return ArtworkType.MOSAIC;

  if (
    t.includes('drawing') ||
    t.includes('disegno') ||
    t.includes('sketch') ||
    t.includes('cartoon (drawing)')
  )
    return ArtworkType.DRAWING;

  // Prints / graphics
  if (
    t.includes('print') ||
    t.includes('stampa') ||
    t.includes('engraving') ||
    t.includes('incision') ||
    t.includes('etching') ||
    t.includes('acquaforte') ||
    t.includes('lithograph') ||
    t.includes('woodcut') ||
    t.includes('xilograf')
  )
    return ArtworkType.PRINT;

  if (
    t.includes('relief') ||
    t.includes('rilievo') ||
    t.includes('bassorilievo') ||
    t.includes('alto rilievo')
  )
    return ArtworkType.RELIEF;
  if (t.includes('installation') || t.includes('installazione')) return ArtworkType.INSTALLATION;

  // Decorative / applied arts (safe bucket)
  if (
    t.includes('decorative') ||
    t.includes('decorazione') ||
    t.includes('applied art') ||
    t.includes('decorative arts') ||
    t.includes('ceramic') ||
    t.includes('glass') ||
    t.includes('silver') ||
    t.includes('jewellery') ||
    t.includes('jewelry')
  )
    return ArtworkType.DECORATIVE;

  if (t.includes('tapestry') || t.includes('arazzo')) return ArtworkType.TAPESTRY;

  return ArtworkType.OTHER;
}

async function fetchWdqs(query: string): Promise<WDQSJson> {
  const url = `${WDQS_ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      accept: 'application/sparql-results+json',
      'user-agent': 'ArtAroundSeeder/1.0 (https://example.org; dev@example.org)',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`WDQS error ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as WDQSJson;
}

type ImportedArtwork = {
  wikidataId: string;
  title: string;
  description?: string;
  author?: string;
  authorWikidataId?: string;
  year?: string;
  startYear?: number;
  endYear?: number;
  artworkType: ArtworkType;
  movement?: string;
  movementWikidataId?: string;
  dimensions?: { height?: number; width?: number; unit: 'cm'; displayText: string };
  materials: string[];
  subjects: string[];
  image?: string; // thumbnail url
  sourceUrl?: string; // described at URL
  inventoryNumber?: string;
};

async function fetchGalleriaBorgheseArtworks(): Promise<ImportedArtwork[]> {
  // We aggregate materials/subjects; sample the rest.
  const sparql = `
SELECT
  ?item ?itemLabel ?itemDescription
  (SAMPLE(?type) AS ?type)
  (SAMPLE(?typeLabel) AS ?typeLabel)
  (SAMPLE(?creator) AS ?creator)
  (SAMPLE(?creatorLabel) AS ?creatorLabel)
  (SAMPLE(?inception) AS ?inception)
  (SAMPLE(?movement) AS ?movement)
  (SAMPLE(?movementLabel) AS ?movementLabel)
  (SAMPLE(?height) AS ?height)
  (SAMPLE(?width) AS ?width)
  (GROUP_CONCAT(DISTINCT ?materialLabel; separator="|") AS ?materials)
  (GROUP_CONCAT(DISTINCT ?subjectLabel; separator="|") AS ?subjects)
  (SAMPLE(?image) AS ?image)
  (SAMPLE(?inv) AS ?inv)
  (SAMPLE(?describedAt) AS ?describedAt)
WHERE {
  VALUES ?museum { wd:${MUSEUM_QID} } .
  { ?item wdt:P195 ?museum . } UNION { ?item wdt:P276 ?museum . }

  OPTIONAL { ?item wdt:P31 ?type . }
  OPTIONAL { ?item wdt:P170 ?creator . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?item wdt:P135 ?movement . }
  OPTIONAL { ?item wdt:P2048 ?height . }
  OPTIONAL { ?item wdt:P2049 ?width . }
  OPTIONAL { ?item wdt:P186 ?material . }
  OPTIONAL { ?item wdt:P921 ?subject . }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P217 ?inv . }
  OPTIONAL { ?item wdt:P973 ?describedAt . }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
GROUP BY ?item ?itemLabel ?itemDescription
`;

  const data = await fetchWdqs(sparql);
  const rows = data.results.bindings;

  const artworks: ImportedArtwork[] = rows
    .map((b) => {
      const qid = qidFromEntityUri(b.item?.value);
      const title = b.itemLabel?.value?.trim() || qid;
      const description = b.itemDescription?.value?.trim();
      const typeQid = b.type?.value ? qidFromEntityUri(b.type.value) : undefined;
      const typeLabel = b.typeLabel?.value;
      const artworkType = mapArtworkType(typeQid, typeLabel);

      const author = b.creatorLabel?.value?.trim();
      const authorWikidataId = b.creator?.value ? qidFromEntityUri(b.creator.value) : undefined;

      const inceptionRaw = b.inception?.value; // e.g. 1605-01-01T00:00:00Z
      let year: string | undefined;
      let startYear: number | undefined;
      let endYear: number | undefined;
      if (inceptionRaw) {
        const y = parseInt(inceptionRaw.slice(0, 4), 10);
        if (!Number.isNaN(y)) {
          year = `${y}`;
          startYear = y;
          endYear = y;
        }
      }

      const movement = b.movementLabel?.value?.trim();
      const movementWikidataId = b.movement?.value ? qidFromEntityUri(b.movement.value) : undefined;

      const h = b.height?.value ? parseFloat(b.height.value) : undefined;
      const w = b.width?.value ? parseFloat(b.width.value) : undefined;
      const dimensions =
        h || w
          ? {
              height: Number.isFinite(h as number) ? Math.round(h as number) : undefined,
              width: Number.isFinite(w as number) ? Math.round(w as number) : undefined,
              unit: 'cm' as const,
              displayText: [
                Number.isFinite(h as number) ? `${Math.round(h as number)} cm (h)` : null,
                Number.isFinite(w as number) ? `${Math.round(w as number)} cm (w)` : null,
              ]
                .filter(Boolean)
                .join(' • '),
            }
          : undefined;

      const materials = (b.materials?.value || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8);

      const subjects = (b.subjects?.value || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 10);

      const image = commonsThumbUrl(b.image?.value, 600) || undefined;

      const describedAt = b.describedAt?.value?.trim();
      const inv = b.inv?.value?.trim();

      return {
        wikidataId: qid,
        title,
        description,
        author,
        authorWikidataId,
        year,
        startYear,
        endYear,
        artworkType,
        movement,
        movementWikidataId,
        dimensions,
        materials,
        subjects,
        image,
        sourceUrl: describedAt,
        inventoryNumber: inv,
      } satisfies ImportedArtwork;
    })
    // keep only meaningful results
    .filter((a) => a.title && a.wikidataId.startsWith('Q'));

  // Sort by title for deterministic output
  artworks.sort((a, b) => a.title.localeCompare(b.title, 'it'));

  return artworks;
}

function generateFloorAndRoom(art: ImportedArtwork): {
  floor: string;
  floorId: string;
  room: string;
} {
  // Simple heuristic:
  // - sculptures mostly on ground floor
  // - paintings mostly on first floor
  const isSculpture = art.artworkType === ArtworkType.SCULPTURE;
  const floorId = isSculpture ? 'piano-terra' : 'primo-piano';
  const floor = isSculpture ? 'Piano Terra' : 'Primo Piano';
  // 1..8 rooms per floor, deterministic
  const roomN = 1 + Math.floor(stableHash01(art.wikidataId) * 8);
  const room = `Sala ${roomN}`;
  return { floor, floorId, room };
}

function generateMapPosition(art: ImportedArtwork): {
  floorId: string;
  x: number;
  y: number;
  rotation: number;
} {
  const { floorId } = generateFloorAndRoom(art);
  const r1 = stableHash01(art.wikidataId + ':x');
  const r2 = stableHash01(art.wikidataId + ':y');
  const r3 = stableHash01(art.wikidataId + ':rot');
  // keep away from borders
  const x = Math.round(100 + r1 * 800);
  const y = Math.round(100 + r2 * 600);
  const rotation = Math.round(r3 * 360);
  return { floorId, x, y, rotation };
}

function buildContentItemsForArtwork(params: {
  art: ImportedArtwork;
  authorId: string;
  museumId: string;
}): Array<Record<string, unknown>> {
  const { art, authorId, museumId } = params;

  const baseTags = [
    art.author ? art.author.toLowerCase() : null,
    art.artworkType.toLowerCase(),
    ...(art.movement ? [art.movement.toLowerCase()] : []),
    'galleria borghese',
  ]
    .filter(Boolean)
    .slice(0, 8) as string[];

  const subjects = art.subjects.slice(0, 4).map((s) => s.toLowerCase());
  const tags = Array.from(new Set([...baseTags, ...subjects])).slice(0, 12);

  // Short (elementary)
  const shortText =
    `“${art.title}”` +
    (art.author ? ` è un'opera di ${art.author}.` : ` è un'opera esposta alla Galleria Borghese.`) +
    (art.year ? ` Risale circa al ${art.year}.` : '') +
    (art.artworkType ? ` È una ${art.artworkType.toLowerCase()}.` : '') +
    (art.subjects.length ? ` Temi: ${art.subjects.slice(0, 3).join(', ')}.` : '');

  // Medium (intermediate)
  const mediumText =
    `In questa opera, “${art.title}”` +
    (art.author ? ` di ${art.author}` : '') +
    (art.year ? ` (circa ${art.year})` : '') +
    `, puoi osservare elementi tipici` +
    (art.movement ? ` del ${art.movement}` : ' della sua epoca') +
    `. ` +
    (art.materials.length ? `Materiali/tecnica: ${art.materials.slice(0, 4).join(', ')}. ` : '') +
    (art.dimensions?.displayText ? `Dimensioni: ${art.dimensions.displayText}. ` : '') +
    (art.sourceUrl ? `Per approfondire: ${art.sourceUrl}` : '');

  // Long (advanced)
  const longText =
    `Approfondimento su “${art.title}”` +
    (art.author ? ` (${art.author})` : '') +
    `: ` +
    (art.description ? art.description : 'scheda descrittiva non disponibile su Wikidata.') +
    ` ` +
    (art.subjects.length ? `Iconografia/temi: ${art.subjects.slice(0, 8).join(', ')}. ` : '') +
    (art.movement ? `Inquadramento storico-artistico: ${art.movement}. ` : '') +
    (art.inventoryNumber ? `Inventario: ${art.inventoryNumber}. ` : '') +
    (art.sourceUrl ? `Fonte: ${art.sourceUrl}` : '');

  const mk = (title: string, text: string, duration: ContentDuration, level: LanguageLevel) => ({
    museumId,
    referenceType: ItemReferenceType.ARTWORK,
    referenceId: art.wikidataId,
    title,
    text,
    duration,
    languageLevel: level,
    authorId,
    license: LicenseType.CC0,
    price: 0,
    isFree: true,
    tags,
  });

  return [
    mk(
      `${art.title} — flash`,
      `“${art.title}”${art.author ? ` di ${art.author}` : ''}.`,
      ContentDuration.FLASH,
      LanguageLevel.CHILDREN,
    ),
    mk(`${art.title} — guida breve`, shortText, ContentDuration.SHORT, LanguageLevel.ELEMENTARY),
    mk(`${art.title} — guida media`, mediumText, ContentDuration.MEDIUM, LanguageLevel.MEDIUM),
    mk(`${art.title} — approfondimento`, longText, ContentDuration.LONG, LanguageLevel.SPECIALIST),
    mk(
      `${art.title} — analisi estesa`,
      `${longText} ${
        art.materials.length
          ? `

Tecnica e materiali (dettaglio): ${art.materials.join(', ')}.`
          : ''
      }` +
        `${
          art.subjects.length
            ? `

Lettura iconografica (dettaglio): ${art.subjects.join(', ')}.`
            : ''
        }` +
        `${
          art.dimensions?.displayText
            ? `

Misure: ${art.dimensions.displayText}.`
            : ''
        }`,
      ContentDuration.EXTENDED,
      LanguageLevel.SPECIALIST,
    ),
  ];
}

function pickFeatured(arts: ImportedArtwork[], wantedQids: string[]): ImportedArtwork[] {
  const byId = new Map(arts.map((a) => [a.wikidataId, a]));
  return wantedQids.map((q) => byId.get(q)).filter(Boolean) as ImportedArtwork[];
}

type SeedOptions = {
  connect?: boolean;
  exitOnComplete?: boolean;
};

export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const { connect = true, exitOnComplete = true } = options;

  try {
    console.log('🌱 Starting database seeding...\n');

    if (connect) {
      await connectDB();
    }

    // Clear existing data
    console.log('🗑️ Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      MuseumModel.deleteMany({}),
      ArtworkModel.deleteMany({}),
      ItemModel.deleteMany({}),
      VisitModel.deleteMany({}),
    ]);
    console.log('✅ Data cleared\n');

    // Align artwork indexes to current schema (unique only on museumId + wikidataId)
    console.log('🧱 Syncing artwork indexes...');
    await ArtworkModel.syncIndexes();
    console.log('✅ Artwork indexes synced\n');

    // ========================================
    // USERS
    // ========================================
    console.log('👥 Creating users...');
    const hashedPassword = await bcrypt.hash('12345678', 10);

    const users = await User.create([
      {
        username: 'admin',
        email: 'admin@artaround.app',
        password: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
      },
      {
        username: 'autore1',
        email: 'autore1@artaround.app',
        password: hashedPassword,
        role: UserRole.AUTHOR,
        isActive: true,
        profile: {
          displayName: 'Autore 1',
          bio: 'Autore di contenuti culturali per musei e percorsi di visita.',
          competenceLevel: CompetenceLevel.AVANZATO,
          preferredLanguageLevel: LanguageLevel.MEDIUM,
          timePreference: TimePreference.NORMALE,
        },
      },
      {
        username: 'utente1',
        email: 'utente1@artaround.app',
        password: hashedPassword,
        role: UserRole.VISITOR,
        isActive: true,
        profile: {
          displayName: 'Utente 1',
          competenceLevel: CompetenceLevel.SEMPLICE,
          preferredLanguageLevel: LanguageLevel.ELEMENTARY,
          timePreference: TimePreference.VELOCE,
        },
      },
    ]);

    const author = users.find((u) => u.username === 'autore1');
    if (!author) throw new Error('Author not created');

    console.log('✅ Users created\n');

    // ========================================
    // MUSEUM
    // ========================================
    console.log('🏛️ Creating Galleria Borghese...');

    const museumCover =
      'https://commons.wikimedia.org/wiki/Special:FilePath/Roma%20Museo%20Borghese.jpg?width=1200';

    const galleriaBorghese = await MuseumModel.create({
      wikidataId: MUSEUM_QID,
      name: 'Galleria Borghese',
      description:
        'La Galleria Borghese è un museo statale italiano ospitato nella Villa Borghese Pinciana (Roma). Celebre per la collezione di sculture di Gian Lorenzo Bernini e per dipinti di Caravaggio, Raffaello, Tiziano e molti altri.',
      location: {
        address: 'Piazzale Scipione Borghese, 5',
        city: 'Roma',
        country: 'Italia',
        region: 'Lazio',
        postalCode: '00197',
        coordinates: { lat: 41.914167, lng: 12.492222 },
      },
      images: [museumCover],
      coverImage: museumCover,
      floors: [
        {
          id: 'piano-terra',
          name: 'Piano Terra',
          level: 0,
          svgContent:
            '<svg viewBox="0 0 1000 800"><rect fill="#f5f5f5" width="1000" height="800"/></svg>',
          dimensions: { width: 1000, height: 800 },
          markers: [],
          connections: [],
        },
        {
          id: 'primo-piano',
          name: 'Primo Piano (Pinacoteca)',
          level: 1,
          svgContent:
            '<svg viewBox="0 0 1000 800"><rect fill="#f5f5f5" width="1000" height="800"/></svg>',
          dimensions: { width: 1000, height: 800 },
          markers: [],
          connections: [],
        },
      ],
      services: {
        ticketInfo: 'Prenotazione obbligatoria. Verifica prezzi/agevolazioni sul sito ufficiale.',
        openingHours: 'Martedì - Domenica: 9:00 - 19:00 (ultimo ingresso 17:00).',
        closedDays: 'Lunedì, 25 dicembre, 1 gennaio.',
        website: 'https://galleriaborghese.beniculturali.it',
        phone: '+39 06 841 3979',
        email: 'info@galleriaborghese.it',
        services: [
          'Prenotazione obbligatoria',
          'Audioguide',
          'Bookshop',
          'Guardaroba',
          'WiFi gratuito',
          'Accessibilità',
        ],
        accessibility:
          'Museo accessibile ai visitatori con disabilità motorie. Ascensore disponibile.',
        wheelchairAccessible: true,
      },
      isActive: true,
    });

    console.log(`✅ Created museum: ${galleriaBorghese.name}\n`);

    // ========================================
    // ARTWORKS (from Wikidata)
    // ========================================
    console.log('🖼️ Importing artworks from Wikidata (WDQS)...');
    const imported = await fetchGalleriaBorgheseArtworks();
    console.log(`✅ Wikidata import: ${imported.length} works\n`);

    console.log('🧩 Creating artworks in DB...');
    const artworksPayload = imported.map((art) => {
      const { floor, room } = generateFloorAndRoom(art);
      const pos = generateMapPosition(art);

      // If dimensions missing, still keep consistent shape
      return {
        wikidataId: art.wikidataId,
        museumId: MUSEUM_QID,
        title: art.title,
        description: art.description ?? 'Scheda in compilazione.',
        author: art.author ?? 'Autore sconosciuto',
        authorWikidataId: art.authorWikidataId ?? undefined,
        year: art.year ?? undefined,
        startYear: art.startYear ?? undefined,
        endYear: art.endYear ?? undefined,
        artworkType: art.artworkType,
        movement: art.movement ?? undefined,
        movementWikidataId: art.movementWikidataId ?? undefined,
        dimensions: art.dimensions ?? undefined,
        materials: art.materials,
        subjects: art.subjects,
        image:
          art.image ??
          'https://commons.wikimedia.org/wiki/Special:FilePath/No%20image%20available.svg?width=600',
        room,
        floor,
        mapPosition: pos,
        // extra fields (safe to ignore if schema doesn't include them)
        inventoryNumber: art.inventoryNumber,
        sourceUrl: art.sourceUrl,
      };
    });

    await ArtworkModel.create(artworksPayload);
    console.log(`✅ Created artworks: ${artworksPayload.length}\n`);

    // ========================================
    // CONTENT ITEMS (auto-generated)
    // ========================================
    console.log('📝 Creating content items...');
    const itemsPayload = imported.flatMap((art) =>
      buildContentItemsForArtwork({
        art,
        authorId: author._id.toString(),
        museumId: MUSEUM_QID,
      }),
    );

    await ItemModel.create(itemsPayload);
    console.log(`✅ Created content items: ${itemsPayload.length}\n`);

    // ========================================
    // VISITS (sample, theme-based)
    // ========================================
    console.log('🧭 Creating visits...');

    // Featured works (common highlights). If some QIDs are missing, we gracefully skip them.
    // (These are well-known highlights and tend to exist in Wikidata with P195/P276 = Galleria Borghese.)
    const FEATURED = pickFeatured(imported, [
      'Q506980', // Apollo e Dafne (Bernini)
      'Q1192658', // Ratto di Proserpina (Bernini)
      'Q1139419', // David (Bernini) — may vary; if missing it's skipped
      'Q2627056', // David con la testa di Golia (Caravaggio)
      'Q189568', // Dama con l'unicorno (Raffaello) — may vary; if missing it's skipped
      'Q202573', // Amor sacro e amor profano (Tiziano) — may vary; if missing it's skipped
    ]);

    const stepForArtwork = (art: ImportedArtwork, order: number) => ({
      id: `step-art-${art.wikidataId}`,
      order,
      type: VisitStepType.ARTWORK,
      artworkId: art.wikidataId,
      isOptional: false,
      estimatedDuration: 12,
    });

    const visitCover =
      FEATURED.find((a) => a.image)?.image ??
      'https://commons.wikimedia.org/wiki/Special:FilePath/Roma%20Museo%20Borghese.jpg?width=800';

    type VisitSeedLike = Record<string, unknown> & {
      targetAudience?: unknown;
      generalInfo?: { estimatedDuration?: number };
      metadata?: unknown;
      steps?: Array<{ type?: unknown }>;
    };

    // Ensure required Visit fields always exist (even if a visit definition forgets them)
    const ensureVisitRequired = (v: VisitSeedLike) => {
      const targetAudience = v.targetAudience ?? {
        languageLevels: [LanguageLevel.ELEMENTARY, LanguageLevel.MEDIUM],
        ageGroups: ['adulti'],
        estimatedDuration: v.generalInfo?.estimatedDuration ?? 60,
      };
      const metadata = v.metadata ?? {
        language: 'it',
        supportedLanguages: ['it', 'en'],
        artworksCount: Array.isArray(v.steps)
          ? v.steps.filter((s) => s.type === VisitStepType.ARTWORK).length
          : 0,
        totalItemsCount: 0,
        estimatedDuration: v.generalInfo?.estimatedDuration ?? 60,
        price: 0,
        isFree: true,
        license: LicenseType.CC0,
        downloadsCount: 0,
        purchasesCount: 0,
      };
      return { ...v, targetAudience, metadata };
    };

    const visits = await VisitModel.create(
      [
        {
          museumId: MUSEUM_QID,
          authorId: author._id.toString(),
          authorName: author.username,
          title: 'Capolavori in 90 minuti',
          description:
            'Un percorso rapido con alcuni dei capolavori più famosi: ideale se hai poco tempo ma vuoi vedere il meglio.',
          coverImage: visitCover,
          steps: [
            {
              id: 'step-0',
              order: 1,
              type: VisitStepType.LOGISTIC,
              logisticTitle: 'Ingresso e orientamento',
              logisticText:
                'Ricorda: la prenotazione è obbligatoria. Parti dal piano terra per le sculture e poi sali alla pinacoteca al primo piano.',
              logisticIcon: 'info',
              isOptional: false,
              estimatedDuration: 10,
            },
            ...FEATURED.slice(0, 6).map((a, i) => ({
              ...stepForArtwork(a, i + 2),
              itemIds: [],
            })),
            {
              id: 'step-end',
              order: FEATURED.length + 2,
              type: VisitStepType.LOGISTIC,
              logisticTitle: 'Fine percorso',
              logisticText:
                'Se hai tempo, torna nelle sale che ti hanno colpito di più e riascolta i contenuti lunghi.',
              logisticIcon: 'check',
              isOptional: false,
              estimatedDuration: 5,
            },
          ],
          generalInfo: {
            estimatedDuration: 90,
            difficulty: 'medio',
            accessibilityFeatures: ['wheelchair', 'audioDescription'],
          },
          targetAudience: {
            languageLevels: [LanguageLevel.ELEMENTARY, LanguageLevel.MEDIUM],
            ageGroups: ['adulti', 'famiglie'],
            estimatedDuration: 90,
          },
          metadata: {
            language: 'it',
            supportedLanguages: ['it', 'en'],
            artworksCount: Math.min(6, FEATURED.length),
            totalItemsCount: 0,
            estimatedDuration: 90,
            price: 0,
            isFree: true,
            license: LicenseType.CC0,
            downloadsCount: 0,
            purchasesCount: 0,
          },
          isPublished: true,
          publishedAt: new Date(),
        },
        {
          museumId: MUSEUM_QID,
          authorId: author._id.toString(),
          authorName: author.username,
          title: 'Barocco: Bernini e Caravaggio',
          description:
            'Un focus sul Barocco tra scultura e pittura: movimento, luce e teatralità nelle opere più celebri.',
          coverImage: visitCover,
          steps: [
            {
              id: 'step-b-0',
              order: 1,
              type: VisitStepType.LOGISTIC,
              logisticTitle: 'Chiavi di lettura del Barocco',
              logisticText:
                'Osserva: dinamismo delle pose, contrasti di luce, espressioni intense e coinvolgimento emotivo dello spettatore.',
              logisticIcon: 'sparkles',
              isOptional: false,
              estimatedDuration: 8,
            },
            ...FEATURED.filter((a) => (a.movement ?? '').toLowerCase().includes('bar'))
              .slice(0, 6)
              .map((a, i) => ({
                ...stepForArtwork(a, i + 2),
                itemIds: [],
              })),
          ],
          generalInfo: {
            estimatedDuration: 75,
            difficulty: 'medio',
            accessibilityFeatures: ['wheelchair'],
          },
          targetAudience: {
            languageLevels: [LanguageLevel.MEDIUM, LanguageLevel.SPECIALIST],
            ageGroups: ['adulti'],
            estimatedDuration: 75,
          },
          metadata: {
            language: 'it',
            supportedLanguages: ['it', 'en'],
            artworksCount: FEATURED.filter((a) =>
              (a.movement ?? '').toLowerCase().includes('bar'),
            ).slice(0, 6).length,
            totalItemsCount: 0,
            estimatedDuration: 75,
            price: 0,
            isFree: true,
            license: LicenseType.CC0,
            downloadsCount: 0,
            purchasesCount: 0,
          },
          isPublished: true,
          publishedAt: new Date(),
        },
      ].map(ensureVisitRequired),
    );

    console.log(`✅ Created visits: ${visits.length}\n`);

    console.log('🎉 Seeding completed successfully!');
    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw error;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const entrypointFile = process.argv[1];

if (entrypointFile && currentFile === entrypointFile) {
  void seedDatabase();
}
