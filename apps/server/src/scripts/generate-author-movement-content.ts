/**
 * generate-author-movement-content.ts
 *
 * Genera Item di tipo AUTHOR/MOVEMENT (biografia/descrizione, non legati a
 * una singola opera) per gli autori e i movimenti effettivamente citati
 * nelle visite pubblicate — stessa matrice durata/livello e stesso motore
 * AI di seed-borghese.ts, prompt e validazioni adattati al registro
 * biografico/informativo invece che "opera davanti a te".
 *
 * Richiede che gli Artwork abbiano già author/movement risolti (vedi
 * backfill-artwork-labels.ts) e AIService configurata e con credito
 * disponibile.
 *
 * Uso:
 *   npx tsx src/scripts/generate-author-movement-content.ts [--dry-run] [--limit N]
 */

import { connectDB } from '../config/database.js';
import { ArtworkModel, ItemModel, VisitModel, User } from '../models/index.js';
import { AIService } from '../utils/ai.service.js';
import { WikidataService } from '../utils/wikidata.service.js';
import {
  ItemReferenceType,
  ContentDuration,
  LanguageLevel,
  LicenseType,
  VisitStepType,
} from '@artaround/shared';

type Entity = {
  referenceType: ItemReferenceType.AUTHOR | ItemReferenceType.MOVEMENT;
  referenceId: string; // QID
  referenceTitle: string; // nome/label già risolto
  description?: string; // descrizione breve Wikidata
  museumId: string; // museo di prima occorrenza — informativo, non usato per il recupero
};

type GeneratedItem = {
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
  authorId: string;
};

type ItemLengthRule = {
  label: string;
  targetWords: number;
  targetChars: number;
  minWords: number;
  maxWords: number;
  minChars: number;
  maxChars: number;
};

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
};

const ITALIAN_CENTURY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\btrecento\b/gi, '1300'],
  [/\bquattrocento\b/gi, '1400'],
  [/\bcinquecento\b/gi, '1500'],
  [/\bseicento\b/gi, '1600'],
  [/\bsettecento\b/gi, '1700'],
  [/\bottocento\b/gi, '1800'],
  [/\bnovecento\b/gi, '1900'],
];

const DISALLOWED_LOCATION_REGEX =
  /\b(?:museo|sala\s+[ivxlcdm\d]+|sala\b|piano\s+terra|primo\s+piano|secondo\s+piano|collezione)\b/i;
const WRITTEN_NUMBER_REGEX =
  /\b(?:due|tre|quattro|cinque|sei|sette|otto|nove|dieci|undici|dodici|tredici|quattordici|quindici|sedici|diciassette|diciotto|diciannove|venti\w*|trenta\w*|quaranta\w*|cinquanta\w*|sessanta\w*|settanta\w*|ottanta\w*|novanta\w*|cento\w*|mille\w*|duemila\w*|trecento\w*|quattrocento\w*|cinquecento\w*|seicento\w*|settecento\w*|ottocento\w*|novecento\w*)\b/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeCommonItalianNumbersToDigits(text: string): string {
  let result = text;
  for (const [pattern, replacement] of ITALIAN_CENTURY_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  for (let value = 300; value >= 2; value--) {
    result = result.replace(
      new RegExp(`\\b${numberToItalianWords(value)}\\b`, 'gi'),
      String(value),
    );
  }
  return result;
}

// Sottoinsieme minimo dei numerali italiani serviti qui (età, secoli, date):
// non servono le migliaia/centinaia complesse usate per le misure delle opere.
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
    const t = Math.floor(n / 10);
    const u = n % 10;
    return tens[t] + (u ? units[u] : '');
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return (h === 1 ? 'cento' : units[h] + 'cento') + (rest ? numberToItalianWords(rest) : '');
  }
  return String(n);
}

function stripLocationSentences(text: string): string {
  let result = text;
  result = result.replace(/\b(?:nel|nella|al|alla|in)\s+museo\b[^,.!?;:]*(?:[,;:]\s*)?/gi, ' ');
  result = result.replace(
    /\b(?:nella|nel|alla|al|in)\s+sala\s+[ivxlcdm\d]+\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = result.replace(
    /\b(?:nel|nella|al|alla|in)\s+(?:primo|secondo)\s+piano\b[^,.!?;:]*(?:[,;:]\s*)?/gi,
    ' ',
  );
  result = splitSentences(result)
    .filter((sentence) => !DISALLOWED_LOCATION_REGEX.test(sentence))
    .join(' ')
    .trim();
  return normalizeSpokenText(result);
}

function sliceToMax(text: string, maxChars: number): string {
  const sliced = text.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  return (
    (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim().replace(/[,:;\-–—\s]+$/u, '') + '.'
  );
}

// Accorcia frase per frase restando sotto maxChars — ma se la prima frase è
// già lunga, il taglio a bordo-frase può scendere sotto il minimo di parole
// pur restando nei caratteri: in quel caso si ripiega su un taglio a
// carattere, che riempie meglio lo spazio disponibile.
function trimToMax(text: string, maxChars: number, minWords: number): string {
  if (text.length <= maxChars) return text;
  const sentences = splitSentences(text);
  let acc = '';
  for (const sentence of sentences) {
    const next = acc ? `${acc} ${sentence}` : sentence;
    if (next.length > maxChars) break;
    acc = next;
  }
  if (acc && countWords(acc) >= minWords) return acc;
  return sliceToMax(text, maxChars);
}

function coerceTextToLength(duration: ContentDuration, text: string): string {
  const rule = ITEM_LENGTH_RULES[duration];
  let result = normalizeSpokenText(text);
  result = stripLocationSentences(result);
  result = normalizeCommonItalianNumbersToDigits(result);
  if (result.length > rule.maxChars) result = trimToMax(result, rule.maxChars, rule.minWords);
  result = normalizeSpokenText(result);
  return result;
}

function validateItemLength(duration: ContentDuration, text: string): string | null {
  const rule = ITEM_LENGTH_RULES[duration];
  const words = countWords(text);
  const chars = text.length;
  if (words < rule.minWords || words > rule.maxWords) {
    return `parole ${words} fuori range ${rule.minWords}-${rule.maxWords}`;
  }
  if (chars < rule.minChars || chars > rule.maxChars) {
    return `caratteri ${chars} fuori range ${rule.minChars}-${rule.maxChars}`;
  }
  return null;
}

function validateContentText(text: string): string | null {
  if (DISALLOWED_LOCATION_REGEX.test(text)) return 'riferimento a museo/sala/piano non consentito';
  if (WRITTEN_NUMBER_REGEX.test(text)) return 'numeri scritti in lettere non consentiti';
  return null;
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

function buildEntityPrompt(entity: Entity): string {
  const kind =
    entity.referenceType === ItemReferenceType.AUTHOR ? 'Artista' : 'Movimento artistico';
  return [
    `${kind}: ${entity.referenceTitle}`,
    entity.description
      ? `Descrizione Wikidata: ${entity.description}.`
      : 'Descrizione: non disponibile.',
    'Usa solo le informazioni fornite. Se un dato manca, omettilo. Non inventare date, opere o dettagli biografici.',
  ].join('\n');
}

function buildItemTitle(
  entityTitle: string,
  duration: ContentDuration,
  level: LanguageLevel,
): string {
  return `${entityTitle} — ${duration} — ${level}`;
}

async function generateItemsForEntity(entity: Entity): Promise<GeneratedItem[]> {
  const items: GeneratedItem[] = [];
  const kind =
    entity.referenceType === ItemReferenceType.AUTHOR ? 'un artista' : 'un movimento artistico';

  for (const duration of ITEM_DURATIONS) {
    for (const languageLevel of ITEM_LEVELS) {
      const rule = ITEM_LENGTH_RULES[duration];
      const systemInstruction = [
        'Sei un autore professionista di audioguide museali in italiano.',
        `Scrivi un solo testo continuo che presenta ${kind}, pensato per essere ascoltato da un visitatore museale.`,
        'Registro informativo e narrativo, come una vera audioguida — non un elenco di date.',
        'Niente elenchi, niente markdown, niente link, niente riferimenti a schede o siti esterni.',
        'Non citare mai un museo, una sala, un piano o una collezione specifica.',
        'Tutti i numeri (anni, secoli, età) devono essere scritti in cifre.',
        `Pubblico di riferimento: ${audienceDescription(languageLevel)}.`,
        `Livello linguistico richiesto: ${languageLevel}.`,
        `Durata richiesta: ${duration}, da trattare come ${rule.label}.`,
        `Vincolo parole: tra ${rule.minWords} e ${rule.maxWords}, target ${rule.targetWords}.`,
        `Vincolo caratteri spazi inclusi: tra ${rule.minChars} e ${rule.maxChars}, target ${rule.targetChars}.`,
        'Resta dentro entrambi i range. È obbligatorio.',
        'Rispondi solo con il testo finale, senza virgolette e senza commenti.',
      ].join('\n');

      const userPrompt = `${buildEntityPrompt(entity)}\n\nGenera adesso un solo testo per ${duration} e livello ${languageLevel}.`;

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
                buildEntityPrompt(entity),
                `Testo precedente fuori vincolo: ${lastIssue}.`,
                `Conteggio attuale: ${previousWords} parole, ${previousChars} caratteri.`,
                `Obiettivo obbligatorio: tra ${rule.minWords} e ${rule.maxWords} parole e tra ${rule.minChars} e ${rule.maxChars} caratteri.`,
                tooShort
                  ? 'Il testo è troppo breve. Espandilo con altri dettagli pertinenti, senza inventare fatti.'
                  : tooLong
                    ? 'Il testo è troppo lungo. Comprimilo eliminando ripetizioni, mantenendo chiarezza.'
                    : 'Il testo è fuori vincolo: riscrivilo correggendo lunghezza e forma finale.',
                'Non citare mai museo, sala, piano o collezione.',
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
                    : 4200,
          },
        );

        finalText = coerceTextToLength(duration, raw);
        previousDraft = finalText;
        const issue = validateItemLength(duration, finalText) ?? validateContentText(finalText);
        if (!issue) {
          lastIssue = '';
          break;
        }
        lastIssue = issue;
      }

      if (lastIssue) {
        throw new Error(`${entity.referenceTitle} → ${lastIssue}`);
      }

      items.push({
        museumId: entity.museumId,
        referenceType: entity.referenceType,
        referenceId: entity.referenceId,
        referenceTitle: entity.referenceTitle,
        sourceLanguage: 'it',
        title: buildItemTitle(entity.referenceTitle, duration, languageLevel),
        text: finalText,
        duration,
        languageLevel,
        license: LicenseType.CC0,
        price: 0,
        isFree: true,
        authorId: '',
      });
    }
  }

  return items;
}

async function collectEntities(): Promise<Entity[]> {
  const visits = await VisitModel.find({}).select('steps').lean();
  const artworkIds = new Set<string>();
  for (const visit of visits) {
    for (const step of visit.steps || []) {
      if (step.type === VisitStepType.ARTWORK && step.artworkId) artworkIds.add(step.artworkId);
    }
  }

  const artworks = await ArtworkModel.find({ wikidataId: { $in: [...artworkIds] } }).lean();

  const entitiesById = new Map<string, Entity>();
  for (const artwork of artworks) {
    if (artwork.authorWikidataId && artwork.author) {
      const id = artwork.authorWikidataId;
      if (!entitiesById.has(id)) {
        entitiesById.set(id, {
          referenceType: ItemReferenceType.AUTHOR,
          referenceId: id,
          referenceTitle: artwork.author,
          museumId: artwork.museumId,
        });
      }
    }
    if (artwork.movementWikidataId && artwork.movement) {
      const id = artwork.movementWikidataId;
      if (!entitiesById.has(id)) {
        entitiesById.set(id, {
          referenceType: ItemReferenceType.MOVEMENT,
          referenceId: id,
          referenceTitle: artwork.movement,
          museumId: artwork.museumId,
        });
      }
    }
  }

  return [...entitiesById.values()];
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit'));
  const limit = limitArg
    ? Number(limitArg.split('=')[1] || process.argv[process.argv.indexOf(limitArg) + 1])
    : undefined;

  await connectDB();
  AIService.assertConfigured();

  const author = await User.findOne({ isAdmin: true });
  if (!author) throw new Error('Nessun utente admin trovato per authorId');

  let entities = await collectEntities();

  const existingReferenceIds = new Set(
    (await ItemModel.distinct('referenceId', {
      referenceType: { $in: [ItemReferenceType.AUTHOR, ItemReferenceType.MOVEMENT] },
    })) as string[],
  );
  entities = entities.filter((e) => !existingReferenceIds.has(e.referenceId));

  if (limit) entities = entities.slice(0, limit);

  console.log(`Entità da generare: ${entities.length} (già presenti escluse)`);

  if (dryRun) {
    for (const e of entities)
      console.log(`  ${e.referenceType} ${e.referenceId} — ${e.referenceTitle}`);
    process.exit(0);
  }

  // Arricchisce con la descrizione breve Wikidata, per entità non già coperte.
  for (const entity of entities) {
    try {
      const wd = await WikidataService.getEntity(entity.referenceId);
      entity.description = wd?.description;
    } catch {
      // Descrizione opzionale: il prompt gestisce già il caso "non disponibile".
    }
    await sleep(200);
  }

  let totalInserted = 0;
  const failed: string[] = [];
  for (const [index, entity] of entities.entries()) {
    console.log(
      `[${index + 1}/${entities.length}] ${entity.referenceTitle} (${entity.referenceType})…`,
    );
    try {
      const items = await generateItemsForEntity(entity);
      items.forEach((item) => (item.authorId = author._id.toString()));
      await ItemModel.insertMany(items, { ordered: false });
      totalInserted += items.length;
      console.log(`  ✅  ${items.length} item generati`);
    } catch (error) {
      failed.push(entity.referenceTitle);
      console.log(`  ⚠️  saltata: ${(error as Error).message}`);
    }
  }

  console.log(`\n✅  Totale item inseriti: ${totalInserted}`);
  if (failed.length > 0) {
    console.log(`⚠️  Entità saltate (${failed.length}): ${failed.join(', ')}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('Generazione fallita:', error);
  process.exit(1);
});
