/**
 * generate-borghese-top50.ts
 *
 * Genera galleria_borghese_top50.json con le 50 opere più famose della
 * Galleria Borghese nel formato usato dal seed di ArtAround.
 *
 * Pipeline:
 *  1. SPARQL su Wikidata → candidati con P195=Q841506, P170, P135, P973
 *  2. Fetch HTML da collezionegalleriaborghese.it/opere/... per ogni candidato
 *  3. Estrae room, floor, description, dimensions, materials
 *  4. Valida campi obbligatori; scarta e passa avanti se mancano
 *  5. Scrive galleria_borghese_top50.json (root workspace)
 *  6. Scrive scarti.csv (root workspace) con motivo scarto
 *
 * Uso:
 *   cd apps/server && npx tsx src/scripts/generate-borghese-top50.ts
 *   -- oppure tramite npm --
 *   npm run generate:borghese --workspace=apps/server
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MUSEUM_QID = 'Q841506'; // Galleria Borghese
const WDQS_ENDPOINT = 'https://query.wikidata.org/sparql';
const TARGET_COUNT = 100;
const SPARQL_LIMIT = 2000;
const USER_AGENT = 'ArtAroundBorgheseGenerator/1.0 (https://artaround.app; dev@artaround.app)';
const FETCH_DELAY_MS = 300; // polite delay between catalog fetches

// Root del monorepo (4 livelli su da src/scripts/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../../..');
const OUT_FILE = path.join(WORKSPACE_ROOT, `galleria_borghese_top${TARGET_COUNT}.json`);
const REJECTS_FILE = path.join(WORKSPACE_ROOT, 'scarti.csv');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BorgheseArtwork {
  wikidataId: string;
  title: string;
  description: string;
  author: string;
  authorWikidataId: string;
  year?: string;
  startYear?: number;
  endYear?: number;
  artworkType: string;
  movement: string;
  movementWikidataId: string;
  dimensions: {
    height?: number;
    width?: number;
    unit: 'cm';
    displayText: string;
  } | null;
  materials: string[];
  subjects: string[];
  image?: string;
  sourceUrl?: string;
  inventoryNumber?: string;
  room: string;
  floor: string;
  /** A=P973-link, B=museum-link+slug, C=label-match (verificare manualmente) */
  querySource: 'A' | 'B' | 'C';
}

type RejectReason =
  | 'missing_wikidata_id'
  | 'missing_author_qid'
  | 'missing_movement_qid'
  | 'missing_described_url'
  | 'missing_room'
  | 'missing_description'
  | 'fetch_error'
  | 'duplicate';

interface Reject {
  wikidataId: string;
  title: string;
  reason: RejectReason;
  detail?: string;
}

type WDBinding = Record<string, { type: string; value: string } | undefined>;
interface WDRow {
  binding: WDBinding;
  source: 'A' | 'B' | 'C';
}

/** Helper per estrarre in sicurezza il valore da un binding SPARQL. */
function val(binding: WDBinding, key: string): string {
  const v = binding[key];
  if (!v || typeof v !== 'object') return '';
  return v.value ?? '';
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function qidFromUri(uri: string): string {
  const m = uri.match(/Q\d+$/);
  return m?.[0] ?? '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function mapArtworkType(instanceOfQid: string): string {
  const q = instanceOfQid.toUpperCase();
  if (['Q3305213', 'Q56676227', 'Q18761202', 'Q22669139'].includes(q)) return 'painting';
  if (['Q860861', 'Q245117'].includes(q)) return 'sculpture';
  if (['Q93184'].includes(q)) return 'drawing';
  if (['Q11060274', 'Q133036', 'Q12018421', 'Q429785'].includes(q)) return 'print';
  if (['Q125191'].includes(q)) return 'photograph';
  if (['Q20437094', 'Q212431'].includes(q)) return 'installation';
  if (['Q860372', 'Q20742776', 'Q682010'].includes(q)) return 'new_media';
  if (['Q87167', 'Q213924', 'Q48498', 'Q571'].includes(q)) return 'manuscript_book';
  if (
    ['Q631931', 'Q19705453', 'Q133067', 'Q7075109', 'Q13464614', 'Q5567091', 'Q21061279', 'Q14745', 'Q2142903'].includes(q)
  )
    return 'decorative_object';
  return 'other';
}

function floorFromSala(n: number): string {
  return n >= 1 && n <= 8 ? 'Piano terra' : 'Piano 1';
}

function commonsThumbUrl(imageUrl: string | undefined, width = 600): string | undefined {
  if (!imageUrl) return undefined;
  const fileMatch =
    imageUrl.match(/Special:FilePath\/(.+)$/i) ??
    imageUrl.match(/File:(.+)$/i) ??
    imageUrl.match(/upload\.wikimedia\.org\/wikipedia\/commons\/.+\/([^/?]+)/i);
  if (!fileMatch) return imageUrl;
  const raw = fileMatch[1].split('?')[0];
  let fileName: string;
  try {
    fileName = decodeURIComponent(raw).replace(/_/g, ' ');
  } catch {
    fileName = raw.replace(/_/g, ' ');
  }
  const encoded = encodeURIComponent(fileName).replace(/%2F/g, '/');
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encoded}?width=${width}`;
}

// ---------------------------------------------------------------------------
// HTTP with retry + exponential backoff
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 4,
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': USER_AGENT,
          ...(options.headers as Record<string, string> ?? {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 32_000);
        console.warn(`    [${res.status}] retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms — ${url}`);
        await sleep(delay);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * 2 ** attempt + Math.random() * 500, 32_000);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Wikidata SPARQL
// ---------------------------------------------------------------------------

async function fetchWikidata(sparql: string): Promise<{ results: { bindings: WDBinding[] } }> {
  // Usa POST per evitare 414 (URL Too Long) su query con molte VALUES
  const res = await fetchWithRetry(WDQS_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `format=json&query=${encodeURIComponent(sparql)}`,
  });
  if (!res.ok) {
    throw new Error(`WDQS ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  return res.json() as Promise<{ results: { bindings: WDBinding[] } }>;
}

// ---------------------------------------------------------------------------
// HTML cache + fetch
// ---------------------------------------------------------------------------

const htmlCache = new Map<string, string>();

async function fetchHtml(url: string): Promise<string> {
  if (htmlCache.has(url)) return htmlCache.get(url)!;
  const res = await fetchWithRetry(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  htmlCache.set(url, html);
  return html;
}

// ---------------------------------------------------------------------------
// Catalog sala listing
// ---------------------------------------------------------------------------

const CATALOG_CATEGORIES = ['pittura', 'scultura', 'arte-antica'];

/**
 * Scarica tutte le pagine lista-sala del sito Borghese (s1→s20, pittura+scultura)
 * e restituisce una Map da slug → numero sala.
 * Usata per:
 * 1) Fallback room quando extractRoom() fallisce sull'HTML dell'opera.
 * 2) Trovare lo slug esatto per i candidati Query B (titolo Wikidata ≠ slug museo).
 */
async function fetchAllCatalogSlugs(): Promise<Map<string, number>> {
  const slugToSala = new Map<string, number>();
  console.log('🗂️  Scarico lista opere per sala dal sito catalogo…');
  for (let sala = 1; sala <= 20; sala++) {
    for (const cat of CATALOG_CATEGORIES) {
      const url = `https://www.collezionegalleriaborghese.it/collezione/${cat}?sala=s${sala}`;
      try {
        const html = await fetchHtml(url);
        for (const m of html.matchAll(/href="\/opere\/([^"]+)"/g)) {
          const slug = m[1];
          if (!slugToSala.has(slug)) slugToSala.set(slug, sala);
        }
      } catch {
        // sala/categoria vuota o errore di rete: ignora
      }
      await sleep(150);
    }
  }
  console.log(`  ✅  ${slugToSala.size} slug in display trovati\n`);
  return slugToSala;
}

/** Normalizza un titolo per il confronto: minuscolo, no diacritici, no articoli, no punteggiatura. */
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['''"]/g, '')
    .replace(/\b(il|la|lo|le|gli|un|una|i|l|dell|della|dello|delle|degli|del)\b/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scarica l'H1 di ogni slug del catalogo (404 silenziosi) e costruisce:
 * - normToSlug: Map<titolo normalizzato, slug>  (per findCatalogSlug)
 * - slugToH1:   Map<slug, titolo raw>           (per Query C)
 */
async function buildCatalogTitleIndex(
  slugToSala: Map<string, number>,
): Promise<{ normToSlug: Map<string, string>; slugToH1: Map<string, string> }> {
  const normToSlug = new Map<string, string>();
  const slugToH1 = new Map<string, string>();
  console.log(`📑  Indexing ${slugToSala.size} catalog titles…`);
  let indexed = 0;
  for (const [slug] of slugToSala) {
    const url = `https://www.collezionegalleriaborghese.it/opere/${slug}`;
    try {
      const html = await fetchHtml(url); // usa cache se già scaricato
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim();
      if (h1) {
        normToSlug.set(normalizeTitle(h1), slug);
        slugToH1.set(slug, h1);
        indexed++;
      }
    } catch {
      // non dovrebbe mai 404 (slug viene dalla lista sala)
    }
    await sleep(200);
  }
  console.log(`  ✅  ${indexed} titoli indicizzati\n`);
  return { normToSlug, slugToH1 };
}

/**
 * Query C: cerca su Wikidata per label italiana gli slug del catalogo
 * non ancora coperti da Query A/B. Usa VALUES label+catalogUrl accoppiati
 * così ogni risultato porta già l'URL del catalogo.
 * Massimo 80 titoli per chiamata per evitare timeout WDQS.
 */
function buildSparqlC(pairs: Array<{ title: string; catalogUrl: string }>): string {
  const valuesList = pairs
    .map((p) => `("${p.title.replace(/"/g, "'")}"@it <${p.catalogUrl}>)`)
    .join('\n    ');
  return `
SELECT
  ?item
  ?itemLabel
  ?itemDescription
  (SAMPLE(?creator)          AS ?creator)
  (SAMPLE(?creatorLabel)     AS ?creatorLabel)
  (COALESCE(SAMPLE(?movDirect), SAMPLE(?movViaCreator)) AS ?movement)
  (COALESCE(SAMPLE(?movDirectLabel), SAMPLE(?movViaCreatorLabel)) AS ?movementLabel)
  (SAMPLE(?instanceOf)       AS ?instanceOf)
  (SAMPLE(?inception)        AS ?inception)
  (SAMPLE(?inv)              AS ?inv)
  (SAMPLE(?image)            AS ?image)
  (SAMPLE(?catalogUrl)       AS ?describedUrl)
  (SAMPLE(?height)           AS ?height)
  (SAMPLE(?width)            AS ?width)
WHERE {
  VALUES (?lb ?catalogUrl) {
    ${valuesList}
  }
  ?item rdfs:label ?lb .
  ?item wdt:P31 ?instanceOf .
  { ?item wdt:P195 wd:${MUSEUM_QID} . } UNION { ?item wdt:P276 wd:${MUSEUM_QID} . }
  OPTIONAL { ?item wdt:P170 ?creator . }
  OPTIONAL { ?item wdt:P135 ?movDirect . }
  OPTIONAL { ?item wdt:P170 ?ct . ?ct wdt:P135 ?movViaCreator . }
  OPTIONAL { ?item wdt:P571  ?inception . }
  OPTIONAL { ?item wdt:P217  ?inv . }
  OPTIONAL { ?item wdt:P18   ?image . }
  OPTIONAL { ?item wdt:P2048 ?height . }
  OPTIONAL { ?item wdt:P2049 ?width . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
GROUP BY ?item ?itemLabel ?itemDescription
`.trim();
}

/** Cerca lo slug esatto nel catalogo partendo dal titolo Wikidata.
 *  Strategie (in ordine di affidabilità):
 *  1. slug derivato dal titolo coincide esattamente
 *  2. titolo normalizzato trovato nel title-index (H1 delle pagine catalogo)
 *  3. Jaccard similarity ≥ 0.45 su token ≥ 4 char  (titolo WD vs slug museo)
 *     con almeno 2 token in comune — tollera parole extra o mancanti
 */
function findCatalogSlug(
  title: string,
  slugToSala: Map<string, number>,
  titleIndex: Map<string, string>,
): string | null {
  const derived = titleToSlug(title);
  if (slugToSala.has(derived)) return derived;
  // title-index lookup (catalogo H1)
  const viaIndex = titleIndex.get(normalizeTitle(title));
  if (viaIndex && slugToSala.has(viaIndex)) return viaIndex;
  // Jaccard similarity tra token WD e token dello slug
  const wdTokens = derived.split('-').filter((t) => t.length >= 4);
  if (wdTokens.length === 0) return null;
  let bestSlug: string | null = null;
  let bestJaccard = 0;
  for (const [slug] of slugToSala) {
    const slugTokens = slug.split('-').filter((t) => t.length >= 4);
    if (slugTokens.length === 0) continue;
    const intersection = wdTokens.filter((t) => slugTokens.includes(t)).length;
    if (intersection < 2) continue; // almeno 2 token in comune
    const union = new Set([...wdTokens, ...slugTokens]).size;
    const jaccard = intersection / union;
    if (jaccard > bestJaccard) { bestJaccard = jaccard; bestSlug = slug; }
  }
  return bestJaccard >= 0.45 ? bestSlug : null;
}

/**
 * Fallback: cerca lo slug del museo sulla pagina Wikipedia italiana (o inglese)
 * dell'opera. Usato quando findCatalogSlug() fallisce per titoli completamente
 * diversi (es. "Pala Baglioni" → "deposizione-trasporto-di-cristo-morto-al-sepolcro").
 */
async function findSlugViaWikipedia(
  wikidataId: string,
  catalogSlugs: Map<string, number>,
): Promise<string | null> {
  // Cerca un sitelink Wikipedia per l'item
  for (const wikiLang of ['it', 'en', 'fr']) {
    const sparql = `
      SELECT ?article WHERE {
        ?article schema:about wd:${wikidataId} ;
                 schema:isPartOf <https://${wikiLang}.wikipedia.org/> .
      } LIMIT 1`;
    let articleUrl: string | null = null;
    try {
      const data = await fetchWikidata(sparql);
      articleUrl = data.results.bindings[0]?.['article']?.value ?? null;
    } catch { }
    if (!articleUrl) continue;
    // Fetch Wikipedia page e cerca URL del catalogo Borghese
    try {
      const html = await fetchHtml(articleUrl);
      await sleep(200);
      // Cerca link diretto alla pagina opera
      const m = html.match(/collezionegalleriaborghese\.it\/opere\/([a-zA-Z0-9-]+)/);
      if (!m) continue;
      const slug = m[1].toLowerCase();
      console.log(`         🔎  Wikipedia (${wikiLang}) → slug '${slug}'`);
      if (catalogSlugs.has(slug)) return slug;
      // Il link esiste ma l'opera non è esposta: ritorna comunque lo slug per
      // permettere al chiamante di decidere (logica missing_room già gestita).
      return slug;
    } catch { }
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTML parsers (regex-based, no external dep)
// ---------------------------------------------------------------------------

/** Estrae "Sala N" e il relativo floor dall'HTML del catalogo Borghese.
 *
 * La pagina ha struttura:
 *   <b>Posizione</b>  →  <a href="/collezione/...?sala=8">Sala VIII</a>
 * oppure per i depositi:
 *   <a href="/collezione/...?sala=dep">Deposito</a>  → da scartare
 */
function extractRoom(html: string): { room: string; floor: string } | null {
  // Strategia 1 (più affidabile): parametro URL sala=s<numero> nel link della scheda
  // Pattern osservato: href="/collezione/pittura?sala=s20"
  const posSection = html.match(
    /[Pp]osizione[\s\S]{0,400}?sala=s?(\d+)/,
  );
  if (posSection) {
    const n = parseInt(posSection[1], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 20) {
      return { room: `Sala ${n}`, floor: floorFromSala(n) };
    }
    // numero fuori range → scarta
    return null;
  }

  // Se c'è Posizione ma punta a "dep" (deposito) → scarta
  if (/[Pp]osizione[\s\S]{0,400}?sala=dep/.test(html)) return null;

  // Strategia 2: cifre romane nel testo (es. "Sala VIII")
  const romanMap: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
    IX: 9, X: 10, XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15,
    XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20,
  };
  const rRoman = /\bSala\s+(X{0,2}(?:IX|IV|V?I{0,3}))\b/gi;
  for (const m of html.matchAll(rRoman)) {
    const roman = m[1].toUpperCase();
    const n = romanMap[roman];
    if (n && n >= 1 && n <= 20) return { room: `Sala ${n}`, floor: floorFromSala(n) };
  }

  // Strategia 3: cifre arabe nel testo (es. "Sala 8")
  const rArab = /\bSala\s+(\d{1,2})\b/gi;
  for (const m of html.matchAll(rArab)) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 20) return { room: `Sala ${n}`, floor: floorFromSala(n) };
  }

  return null;
}

/** Estrae descrizione dalla pagina: blocco <hr>…<hr> > meta description > primo <p> lungo. */
function extractDescription(html: string): string {
  // 1) Formato catalogo Borghese: testo tra le due <hr> (blocco descrittivo principale)
  const hrBlocks = [...html.matchAll(/<hr\s*\/?>([\s\S]{80,5000}?)<hr\s*\/?>/gi)];
  for (const match of hrBlocks) {
    const text = match[1]
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/g, (e) => {
        const map: Record<string, string> = {
          '&egrave;': 'è', '&agrave;': 'à', '&igrave;': 'ì', '&ograve;': 'ò',
          '&ugrave;': 'ù', '&eacute;': 'é', '&rsquo;': "'", '&lsquo;': "'",
          '&ldquo;': '"', '&rdquo;': '"', '&amp;': '&', '&ndash;': '–',
          '&mdash;': '—', '&nbsp;': ' ',
        };
        return map[e] ?? e;
      })
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 80) return text;
  }

  // 2) <meta name="description" content="...">
  let m =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{30,})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{30,})["'][^>]+name=["']description["']/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();

  // 3) og:description
  m =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{30,})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{30,})["'][^>]+property=["']og:description["']/i);
  if (m) return m[1].replace(/\s+/g, ' ').trim();

  // 4) Primo paragrafo lungo del body
  for (const pm of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = pm[1]
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 80) return text;
  }

  return '';
}

/** Estrae dimensioni dalla pagina. Gestisce:
 *  - "cm 104 x 85"  (formato catalogo Borghese)
 *  - "123 × 456 cm" (formato generico)
 *  - "123 cm"        (singola misura)
 */
function extractDimensions(html: string): BorgheseArtwork['dimensions'] {
  // Formato Borghese: "cm H x W" (con spazio opzionale e separatori vari)
  const borgheseTwo =
    html.match(/\bcm\s+(\d+(?:[.,]\d+)?)\s*[x×xX]\s*(\d+(?:[.,]\d+)?)/i);
  if (borgheseTwo) {
    const h = parseFloat(borgheseTwo[1].replace(',', '.'));
    const w = parseFloat(borgheseTwo[2].replace(',', '.'));
    if (Number.isFinite(h) && Number.isFinite(w)) {
      return {
        height: Math.round(h),
        width: Math.round(w),
        unit: 'cm',
        displayText: `${Math.round(h)} × ${Math.round(w)} cm`,
      };
    }
  }

  // Formato generico: "H x W cm"
  const genericTwo =
    html.match(/(\d{2,4}(?:[.,]\d+)?)\s*[×xX]\s*(\d{2,4}(?:[.,]\d+)?)\s*cm/i);
  if (genericTwo) {
    const h = parseFloat(genericTwo[1].replace(',', '.'));
    const w = parseFloat(genericTwo[2].replace(',', '.'));
    if (Number.isFinite(h) && Number.isFinite(w)) {
      return {
        height: Math.round(h),
        width: Math.round(w),
        unit: 'cm',
        displayText: `${Math.round(h)} × ${Math.round(w)} cm`,
      };
    }
  }

  // Singola misura "cm 123" o "123 cm"
  const one =
    html.match(/\bcm\s+(\d{2,4}(?:[.,]\d+)?)/i) ??
    html.match(/(\d{2,4}(?:[.,]\d+)?)\s*cm/i);
  if (one) {
    const h = parseFloat(one[1].replace(',', '.'));
    if (Number.isFinite(h)) {
      return { height: Math.round(h), unit: 'cm', displayText: `${Math.round(h)} cm` };
    }
  }

  return null;
}

/** Estrae materiali dalla sezione "Materia / Tecnica" della scheda. */
function extractMaterials(html: string): string[] {
  // Formato catalogo Borghese:
  //   <b>Materia / Tecnica</b></div>...<div class="vline">olio su tavola<br></div>
  const borgheseMatch = html.match(
    /Materia\s*\/\s*Tecnica[^<]*<\/[^>]+>[\s\S]{0,200}?vline[^>]*>([\s\S]{0,300}?)<\/div>/i,
  );
  if (borgheseMatch) {
    const raw = borgheseMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (raw.length > 1) {
      return raw
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 1 && s.length < 100)
        .slice(0, 8);
    }
  }

  // Fallback generico
  const sec = html.match(
    /[Mm]ateria\s*[/\/]?\s*[Tt]ecnica[^<]*<\/[^>]+>([\s\S]{0,500}?)(?:<\/(?:p|div|td|li|span)>|Misure|Datazione|Sala)/i,
  );
  if (sec) {
    const raw = sec[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const parts = raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 100);
    if (parts.length) return parts.slice(0, 8);
  }

  return [];
}

/** Estrae etichette soggetti/temi dalla scheda HTML (tag, keyword, sezione "Soggetto"). */
function extractSubjects(html: string): string[] {
  // Cerca blocco "Soggetto" / "Subject" / "Iconografia"
  const sec = html.match(
    /(?:[Ss]oggetto|[Ii]conografia|[Kk]eyword|[Ss]ubject)[\s\S]{0,20}?(?:<[^>]+>)?([\s\S]{0,500}?)(?:<\/(?:p|div|td|li|span)>|Misure|Datazione|Sala|Materia)/i,
  );
  if (sec) {
    const raw = sec[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const parts = raw
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 80);
    if (parts.length) return parts.slice(0, 10);
  }

  // Fallback: cerca meta keywords
  const kw = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i);
  if (kw) {
    return kw[1]
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
  }

  return [];
}

// ---------------------------------------------------------------------------
// SPARQL query
// ---------------------------------------------------------------------------

/**
 * Query A (prioritaria): opere con P973 → collezionegalleriaborghese.it/opere/
 *   Garantisce la disponibilità dell'URL scheda per room/description.
 *
 * Query B (supplementare): opere con P195/P276 = Borghese, P170, P31
 *   senza P973. Useremo lo slug derivato dal titolo per cercare la scheda.
 */
function buildSparqlA(): string {
  return `
SELECT
  ?item
  ?itemLabel
  ?itemDescription
  (SAMPLE(?creator)          AS ?creator)
  (SAMPLE(?creatorLabel)     AS ?creatorLabel)
  (COALESCE(SAMPLE(?movDirect), SAMPLE(?movViaCreator)) AS ?movement)
  (COALESCE(SAMPLE(?movDirectLabel), SAMPLE(?movViaCreatorLabel)) AS ?movementLabel)
  (SAMPLE(?instanceOf)       AS ?instanceOf)
  (SAMPLE(?inception)        AS ?inception)
  (SAMPLE(?inv)              AS ?inv)
  (SAMPLE(?image)            AS ?image)
  (SAMPLE(?describedUrl)     AS ?describedUrl)
  (SAMPLE(?height)           AS ?height)
  (SAMPLE(?width)            AS ?width)
WHERE {
  VALUES ?museum { wd:${MUSEUM_QID} } .
  { ?item wdt:P195 ?museum . } UNION { ?item wdt:P276 ?museum . }

  ?item wdt:P31  ?instanceOf .
  ?item wdt:P973 ?describedUrl .
  FILTER(CONTAINS(STR(?describedUrl), "collezionegalleriaborghese.it/opere/"))

  OPTIONAL { ?item wdt:P170 ?creator . }
  OPTIONAL { ?item wdt:P135 ?movDirect . }
  OPTIONAL {
    ?item wdt:P170 ?creatorTmp .
    ?creatorTmp wdt:P135 ?movViaCreator .
  }
  OPTIONAL { ?item wdt:P571  ?inception . }
  OPTIONAL { ?item wdt:P217  ?inv . }
  OPTIONAL { ?item wdt:P18   ?image . }
  OPTIONAL { ?item wdt:P2048 ?height . }
  OPTIONAL { ?item wdt:P2049 ?width . }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
GROUP BY ?item ?itemLabel ?itemDescription
ORDER BY ASC(?item)
LIMIT ${SPARQL_LIMIT}
`.trim();
}

/** Query supplementare: opere senza P973 (pool più ampio, URL costruita dallo slug). */
function buildSparqlB(): string {
  return `
SELECT
  ?item
  ?itemLabel
  ?itemDescription
  (SAMPLE(?creator)          AS ?creator)
  (SAMPLE(?creatorLabel)     AS ?creatorLabel)
  (COALESCE(SAMPLE(?movDirect), SAMPLE(?movViaCreator)) AS ?movement)
  (COALESCE(SAMPLE(?movDirectLabel), SAMPLE(?movViaCreatorLabel)) AS ?movementLabel)
  (SAMPLE(?instanceOf)       AS ?instanceOf)
  (SAMPLE(?inception)        AS ?inception)
  (SAMPLE(?inv)              AS ?inv)
  (SAMPLE(?image)            AS ?image)
  (SAMPLE(?height)           AS ?height)
  (SAMPLE(?width)            AS ?width)
WHERE {
  VALUES ?museum { wd:${MUSEUM_QID} } .
  { ?item wdt:P195 ?museum . } UNION { ?item wdt:P276 ?museum . }

  ?item wdt:P31  ?instanceOf .
  ?item wdt:P170 ?creator .
  OPTIONAL { ?item wdt:P135 ?movDirect . }
  OPTIONAL {
    ?item wdt:P170 ?creatorTmp .
    ?creatorTmp wdt:P135 ?movViaCreator .
  }

  OPTIONAL { ?item wdt:P571  ?inception . }
  OPTIONAL { ?item wdt:P217  ?inv . }
  OPTIONAL { ?item wdt:P18   ?image . }
  OPTIONAL { ?item wdt:P2048 ?height . }
  OPTIONAL { ?item wdt:P2049 ?width . }

  FILTER NOT EXISTS { ?item wdt:P973 ?du . FILTER(CONTAINS(STR(?du), "collezionegalleriaborghese.it/opere/")) }

  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }
}
GROUP BY ?item ?itemLabel ?itemDescription
ORDER BY ASC(?item)
LIMIT ${SPARQL_LIMIT}
`.trim();
}

/**
 * Costruisce lo slug del catalogo Borghese da un titolo italiano.
 * Es: "Davide con la testa di Golia" → "davide-con-la-testa-di-golia"
 */
function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // rimuovi diacritici
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🔍  Fetching Wikidata candidates for Galleria Borghese…\n');

  // ---- Step 1: scarica lista slug del catalogo + indicizza H1 ----
  const catalogSlugs = await fetchAllCatalogSlugs();
  const { normToSlug, slugToH1 } = await buildCatalogTitleIndex(catalogSlugs);

  // ---- Step 2: Query A (P973 → URL catalogo garantita) ----
  console.log('  [A] Query opere con scheda catalogo Borghese...');
  const dataA = await fetchWikidata(buildSparqlA());
  const rowsA = dataA.results.bindings;
  console.log(`  ✅  ${rowsA.length} candidati con P973\n`);

  // ---- Step 3: Query B (senza P973, P170 obbligatorio) ----
  console.log('  [B] Query opere senza scheda (slug derivato dal titolo)...');
  let rowsB: WDBinding[] = [];
  try {
    const dataB = await fetchWikidata(buildSparqlB());
    rowsB = dataB.results.bindings;
    console.log(`  ✅  ${rowsB.length} candidati supplementari\n`);
  } catch (err) {
    console.warn(`  ⚠️  Query B fallita: ${(err as Error).message} — uso solo pool A\n`);
  }

  // ---- Step 4: Query C (label-lookup per slug non coperti da A/B) ----
  // Raccoglie tutti i QID già noti (da A e B) per evitare duplicati nel pool
  const knownQids = new Set<string>(
    [...rowsA, ...rowsB].map((r) => {
      const u = r['item'];
      return u ? qidFromUri(u.value) : '';
    }).filter(Boolean),
  );

  // Coppie title+catalogUrl per i slug del catalogo non ancora in Wikidata
  const cPairs: Array<{ title: string; catalogUrl: string }> = [];
  for (const [slug, h1] of slugToH1) {
    const catalogUrl = `https://www.collezionegalleriaborghese.it/opere/${slug}`;
    cPairs.push({ title: h1, catalogUrl });
  }

  let rowsC: WDBinding[] = [];
  const C_BATCH = 40;
  console.log(`  [C] Label-lookup su Wikidata per ${cPairs.length} slug catalogo (batch da ${C_BATCH})…`);
  for (let i = 0; i < cPairs.length; i += C_BATCH) {
    const batch = cPairs.slice(i, i + C_BATCH);
    try {
      const data = await fetchWikidata(buildSparqlC(batch));
      const newRows = data.results.bindings.filter((r) => {
        const qid = qidFromUri(r['item']?.value ?? '');
        return qid && !knownQids.has(qid);
      });
      rowsC.push(...newRows);
      newRows.forEach((r) => knownQids.add(qidFromUri(r['item']?.value ?? '')));
    } catch (err) {
      console.warn(`  ⚠️  Query C batch ${i / C_BATCH + 1} fallita: ${(err as Error).message}`);
    }
    await sleep(500);
  }
  console.log(`  ✅  ${rowsC.length} candidati aggiuntivi via label\n`);

  // ---- Step 5: Unisci A + B + C ----
  const rows: WDRow[] = [
    ...rowsA.map((r): WDRow => ({ binding: r, source: 'A' })),
    ...rowsB.map((r): WDRow => ({ binding: r, source: 'B' })),
    ...rowsC.map((r): WDRow => ({ binding: r, source: 'C' })),
  ];
  console.log(`📋  Pool totale: ${rows.length} candidati\n`);

  const artworks: BorgheseArtwork[] = [];
  const rejects: Reject[] = [];
  const seenQids = new Set<string>();

  for (let i = 0; i < rows.length && artworks.length < TARGET_COUNT; i++) {
    const { binding: row, source: rowSource } = rows[i];
    const progress = `[${String(artworks.length).padStart(2, '0')}/${TARGET_COUNT}] [${String(i + 1).padStart(3, '0')}/${rows.length}]`;

    const wikidataId = qidFromUri(val(row, 'item'));
    const title = val(row, 'itemLabel').trim() || wikidataId;
    const wdDescription = val(row, 'itemDescription').trim();

    // --- Validazione Wikidata IDs ---
    if (!wikidataId.match(/^Q\d+$/)) {
      rejects.push({ wikidataId: wikidataId || 'N/A', title, reason: 'missing_wikidata_id' });
      continue;
    }
    if (seenQids.has(wikidataId)) {
      rejects.push({ wikidataId, title, reason: 'duplicate' });
      continue;
    }
    const authorWikidataId = qidFromUri(val(row, 'creator'));
    if (!authorWikidataId.match(/^Q\d+$/)) {
      console.log(`${progress} ⚠️  ${title} — missing authorWikidataId`);
      rejects.push({ wikidataId, title, reason: 'missing_author_qid' });
      continue;
    }
    const movementWikidataId = qidFromUri(val(row, 'movement'));
    if (!movementWikidataId.match(/^Q\d+$/)) {
      console.log(`${progress} ⚠️  ${title} — movementWikidataId non trovato (campo vuoto)`);
    }

    // --- Determina URL catalogo ---
    // Query A (P973): fonte autorevole → usa sempre, anche se slug non è in catalogSlugs
    // Query B/C: cerca titolo → fallback Wikipedia → se non trovato in catalogSlugs → deposito
    const p973Url = val(row, 'describedUrl').trim();
    let resolvedSlug: string | null = null;
    let preKnownRoom: { room: string; floor: string } | null = null;

    if (p973Url) {
      // Query A: slug dall'URL P973 — fonte autorevole
      resolvedSlug = p973Url.match(/\/opere\/([^/?#]+)/)?.[1] ?? null;
      if (resolvedSlug && catalogSlugs.has(resolvedSlug)) {
        const salaNum = catalogSlugs.get(resolvedSlug)!;
        preKnownRoom = { room: `Sala ${salaNum}`, floor: floorFromSala(salaNum) };
      }
      // Se slug non è in catalogSlugs: la room verrà da extractRoom(html)
    } else {
      // Query B/C: cerca il titolo nel catalogo sala-per-sala
      resolvedSlug = findCatalogSlug(title, catalogSlugs, normToSlug);
      // Fallback: cerca slug su Wikipedia italiana/inglese
      if (!resolvedSlug) {
        process.stdout.write(`${progress} 🔍  Wikipedia lookup '${title}'… `);
        resolvedSlug = await findSlugViaWikipedia(wikidataId, catalogSlugs);
        process.stdout.write(resolvedSlug ? `trovato '${resolvedSlug}'\n` : 'non trovato\n');
        await sleep(FETCH_DELAY_MS);
      }
      // Per B/C: se non troviamo lo slug nelle sale esposte → in deposito
      if (!resolvedSlug || !catalogSlugs.has(resolvedSlug)) {
        const detail = resolvedSlug
          ? `slug '${resolvedSlug}' non nelle sale esposte`
          : 'slug non trovato nel catalogo';
        console.log(`${progress} ⚠️  ${title} — ${detail}`);
        rejects.push({ wikidataId, title, reason: 'missing_room', detail });
        continue;
      }
      const salaNum = catalogSlugs.get(resolvedSlug)!;
      preKnownRoom = { room: `Sala ${salaNum}`, floor: floorFromSala(salaNum) };
    }

    if (!resolvedSlug) {
      rejects.push({ wikidataId, title, reason: 'missing_described_url' });
      continue;
    }

    const describedUrl = `https://www.collezionegalleriaborghese.it/opere/${resolvedSlug}`;

    // --- Fetch HTML catalogo (per description, materials, dimensions) ---
    let html: string;
    try {
      process.stdout.write(`${progress} 🌐  ${title} [${preKnownRoom?.room ?? 'sala?'}] … `);
      html = await fetchHtml(describedUrl);
      process.stdout.write('OK\n');
    } catch (err) {
      process.stdout.write(`\n`);
      const detail = (err as Error).message;
      console.warn(`         ❌ fetch_error: ${detail} — ${describedUrl}`);
      rejects.push({ wikidataId, title, reason: 'fetch_error', detail });
      await sleep(FETCH_DELAY_MS);
      continue;
    }

    // --- Room: catalogSlugs è fonte primaria; per Query A senza sala nota, usa HTML ---
    const htmlRoom = extractRoom(html);
    let roomData: { room: string; floor: string } | null = preKnownRoom ?? htmlRoom;
    if (preKnownRoom && htmlRoom && htmlRoom.room !== preKnownRoom.room) {
      console.log(`         ℹ️  room HTML (${htmlRoom.room}) diversa da catalogo (${preKnownRoom.room}), uso catalogo`);
    }
    if (!roomData) {
      console.log(`         ⚠️  room non trovata (deposito?) — ${describedUrl}`);
      rejects.push({ wikidataId, title, reason: 'missing_room', detail: describedUrl });
      await sleep(FETCH_DELAY_MS);
      continue;
    }

    // --- Estrai description: prima da HTML catalogo, poi da Wikidata come fallback ---
    let description = extractDescription(html);
    if ((!description || description.length < 30) && wdDescription.length >= 30) {
      description = wdDescription;
      console.log(`         ℹ️  description da Wikidata (catalogo non disponibile)`);
    }
    if (!description || description.length < 30) {
      console.log(`         ⚠️  description vuota — ${describedUrl}`);
      rejects.push({ wikidataId, title, reason: 'missing_description', detail: describedUrl });
      await sleep(FETCH_DELAY_MS);
      continue;
    }

    // --- Tutti i controlli passati → costruisci oggetto ---
    seenQids.add(wikidataId);

    const instanceOfQid = qidFromUri(val(row, 'instanceOf'));
    const artworkType = mapArtworkType(instanceOfQid);

    const author = val(row, 'creatorLabel').trim();
    const movement = val(row, 'movementLabel').trim();

    const inceptionRaw = val(row, 'inception');
    let year: string | undefined;
    let startYear: number | undefined;
    let endYear: number | undefined;
    if (inceptionRaw) {
      const y = parseInt(inceptionRaw.slice(0, 4), 10);
      if (!Number.isNaN(y) && y > 0) {
        year = String(y);
        startYear = y;
        endYear = y;
      }
    }

    // Dimensions: preferisci i valori Wikidata (P2048/P2049),
    // poi prova a estrarre dall'HTML della scheda.
    let dimensions: BorgheseArtwork['dimensions'] = null;
    const wdHRaw = val(row, 'height');
    const wdWRaw = val(row, 'width');
    const wdH = wdHRaw ? parseFloat(wdHRaw) : NaN;
    const wdW = wdWRaw ? parseFloat(wdWRaw) : NaN;
    if (Number.isFinite(wdH) || Number.isFinite(wdW)) {
      const parts: string[] = [];
      if (Number.isFinite(wdH)) parts.push(`${Math.round(wdH)} cm (h)`);
      if (Number.isFinite(wdW)) parts.push(`${Math.round(wdW)} cm (w)`);
      dimensions = {
        height: Number.isFinite(wdH) ? Math.round(wdH) : undefined,
        width: Number.isFinite(wdW) ? Math.round(wdW) : undefined,
        unit: 'cm',
        displayText: parts.join(' • '),
      };
    } else {
      dimensions = extractDimensions(html);
    }

    // Materials: da HTML della scheda (non più in SPARQL per alleggerire la query)
    const materials = extractMaterials(html);

    // Subjects: da HTML della scheda
    const subjects = extractSubjects(html);

    const image = commonsThumbUrl(val(row, 'image'), 600);
    const inventoryNumber = val(row, 'inv').trim() || undefined;

    artworks.push({
      wikidataId,
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
      sourceUrl: describedUrl,
      inventoryNumber,
      room: roomData.room,
      floor: roomData.floor,
      querySource: rowSource,
    });

    console.log(`         ✅  ${roomData.room} (${roomData.floor}) — ${artworkType}`);
    await sleep(FETCH_DELAY_MS);
  }

  // ---------------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------------

  console.log(`\n📊  Risultato: ${artworks.length} opere, ${rejects.length} scarti\n`);

  await fs.writeFile(OUT_FILE, JSON.stringify(artworks, null, 2), 'utf-8');
  console.log(`✅  JSON scritto: ${OUT_FILE}`);

  const csvHeader = 'wikidataId,title,reason,detail';
  const csvRows = rejects.map(
    (r) =>
      `${r.wikidataId},"${r.title.replace(/"/g, '""')}",${r.reason},"${(r.detail ?? '').replace(/"/g, '""')}"`,
  );
  await fs.writeFile(REJECTS_FILE, [csvHeader, ...csvRows].join('\n'), 'utf-8');
  console.log(`✅  Scarti scritti: ${REJECTS_FILE}`);

  // ---------------------------------------------------------------------------
  // Assertions
  // ---------------------------------------------------------------------------

  console.log('\n🔍  Assertions finali…');
  const errors: string[] = [];

  if (artworks.length < TARGET_COUNT) {
    console.warn(
      `⚠️   Trovate ${artworks.length}/${TARGET_COUNT} opere. ` +
        `I dati Wikidata per Galleria Borghese con tutti i vincoli (autore, movimento, sala, descrizione) ` +
        `sono limitati a questo numero. Scarti: ${REJECTS_FILE}`,
    );
  }

  const qidCheck = new Set<string>();
  for (const a of artworks) {
    if (!/^Q\d+$/.test(a.wikidataId))
      errors.push(`❌  wikidataId non valido: ${a.wikidataId}`);
    if (!/^Q\d+$/.test(a.authorWikidataId))
      errors.push(`❌  authorWikidataId non valido per ${a.wikidataId}`);
    if (a.movementWikidataId && !/^Q\d+$/.test(a.movementWikidataId))
      errors.push(`❌  movementWikidataId non valido per ${a.wikidataId}`);
    if (!/^Sala \d+$/.test(a.room))
      errors.push(`❌  room non valida per ${a.wikidataId}: "${a.room}"`);
    if (!['Piano terra', 'Piano 1'].includes(a.floor))
      errors.push(`❌  floor non valido per ${a.wikidataId}: "${a.floor}"`);
    if (!a.description || a.description.length < 10)
      errors.push(`❌  description vuota per ${a.wikidataId}`);
    if (a.dimensions && a.dimensions.unit !== 'cm')
      errors.push(`❌  dimensions.unit !== 'cm' per ${a.wikidataId}`);
    if (qidCheck.has(a.wikidataId))
      errors.push(`❌  wikidataId duplicato: ${a.wikidataId}`);
    qidCheck.add(a.wikidataId);
  }

  if (errors.length === 0) {
    console.log(`✅  Tutte le assertions passate! (${artworks.length} opere)\n`);
  } else {
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('💥  Errore fatale:', err);
  process.exit(1);
});
