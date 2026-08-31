/**
 * generate-visits.ts
 *
 * Compone visite guidate reali a partire da artwork/item già seedati per un museo,
 * per soddisfare il requisito di specifica: "ci devono essere almeno 3 visite di
 * almeno 10 opere ciascuna sullo stesso museo, differenziate per contenuti, livello
 * di conoscenza".
 *
 * Per ogni museo con abbastanza opere+contenuti crea 3 visite (famiglie/generale/
 * esperti) sullo STESSO set di opere ordinato per piano/sala, differenziate per
 * livello linguistico e durata primaria degli item collegati — esattamente come
 * l'esempio "Ritratto di frate..." nelle specifiche (stessa opera, toni diversi).
 *
 * Idempotente: salta le visite il cui titolo esiste già per quel museo.
 *
 * Uso:
 *   npx tsx src/scripts/generate-visits.ts
 */

import { connectDB } from '../config/database.js';
import { MuseumModel, ArtworkModel, ItemModel, VisitModel, User } from '../models/index.js';
import {
  ItemReferenceType,
  LanguageLevel,
  ContentDuration,
  LicenseType,
  VisitStepType,
  type VisitStep,
} from '@artaround/shared';

const MIN_ARTWORKS_PER_VISIT = 10;
const MAX_ARTWORKS_PER_VISIT = 20;
const WALK_BUFFER_SECONDS = 45;

const DURATION_SECONDS: Record<ContentDuration, number> = {
  [ContentDuration.FLASH]: 3,
  [ContentDuration.SHORT]: 15,
  [ContentDuration.MEDIUM]: 60,
  [ContentDuration.LONG]: 240,
  [ContentDuration.EXTENDED]: 600,
};

type VisitProfile = {
  key: string;
  titleSuffix: string;
  level: LanguageLevel;
  primaryDuration: ContentDuration;
  descriptionHint: string;
  minAge?: number;
  maxAge?: number;
};

const PROFILES: VisitProfile[] = [
  {
    key: 'famiglie',
    titleSuffix: 'per famiglie',
    level: LanguageLevel.CHILDREN,
    primaryDuration: ContentDuration.SHORT,
    descriptionHint: 'racconti brevi e semplici, pensata per bambini e famiglie',
    minAge: 6,
    maxAge: 12,
  },
  {
    key: 'generale',
    titleSuffix: 'generale',
    level: LanguageLevel.MEDIUM,
    primaryDuration: ContentDuration.MEDIUM,
    descriptionHint: 'un percorso completo con spiegazioni chiare, adatto al visitatore medio',
  },
  {
    key: 'esperti',
    titleSuffix: 'per appassionati',
    level: LanguageLevel.SPECIALIST,
    primaryDuration: ContentDuration.LONG,
    descriptionHint: 'un approfondimento su storia, stile e dettagli tecnici delle opere',
    minAge: 16,
  },
];

type MuseumServices = {
  openingHours?: string;
  ticketInfo?: string;
  services?: string[];
  accessibility?: string;
  wheelchairAccessible?: boolean;
};

type MuseumLean = {
  _id: unknown;
  name: string;
  wikidataId: string;
  services?: MuseumServices;
};

async function resolveAuthorIds(): Promise<string[]> {
  const authors = await User.find({ username: { $in: ['autore1', 'autore2'] } })
    .select('_id username')
    .lean();

  const byUsername = new Map(authors.map((a) => [a.username, String(a._id)]));
  const ids = [byUsername.get('autore1'), byUsername.get('autore2')].filter((id): id is string =>
    Boolean(id),
  );

  if (ids.length === 0) {
    throw new Error('Nessun utente autore1/autore2 trovato: esegui prima npm run seed');
  }

  return ids;
}

async function generateVisitsForMuseum(museum: MuseumLean, authorIds: string[]): Promise<number> {
  const artworks = await ArtworkModel.find({ museumId: museum.wikidataId })
    .select('wikidataId title room floor')
    .sort({ floor: 1, room: 1, title: 1 })
    .lean();

  if (artworks.length < MIN_ARTWORKS_PER_VISIT) {
    console.log(`   ⏭️  Solo ${artworks.length} opere, salto (minimo ${MIN_ARTWORKS_PER_VISIT})`);
    return 0;
  }

  const items = await ItemModel.find({
    museumId: museum.wikidataId,
    referenceType: ItemReferenceType.ARTWORK,
  })
    .select('_id referenceId duration languageLevel')
    .lean();

  // referenceId (wikidataId opera) -> languageLevel -> duration -> itemId
  const itemsByArtwork = new Map<string, Map<LanguageLevel, Map<ContentDuration, string>>>();
  for (const item of items) {
    if (!item.referenceId) continue;
    const byLevel = itemsByArtwork.get(item.referenceId) ?? new Map();
    const byDuration = byLevel.get(item.languageLevel as LanguageLevel) ?? new Map();
    byDuration.set(item.duration as ContentDuration, String(item._id));
    byLevel.set(item.languageLevel as LanguageLevel, byDuration);
    itemsByArtwork.set(item.referenceId, byLevel);
  }

  let createdCount = 0;

  for (const [profileIndex, profile] of PROFILES.entries()) {
    const title = `${museum.name} — Visita ${profile.titleSuffix}`;

    const existing = await VisitModel.findOne({ museumId: museum.wikidataId, title })
      .select('_id')
      .lean();
    if (existing) {
      console.log(`   ⏭️  "${title}" esiste già, salto`);
      continue;
    }

    const primarySeconds = DURATION_SECONDS[profile.primaryDuration];
    const steps: Omit<VisitStep, never>[] = [
      {
        id: `logistic-intro-${profile.key}`,
        order: 0,
        type: VisitStepType.LOGISTIC,
        logisticTitle: 'Benvenuti',
        logisticText:
          [museum.services?.openingHours, museum.services?.ticketInfo]
            .filter(Boolean)
            .join(' — ') || `Benvenuti alla visita ${profile.titleSuffix} del ${museum.name}.`,
        logisticIcon: 'info',
        isOptional: false,
      },
    ];

    let order = 1;
    let totalSeconds = 90; // buffer ingresso/uscita

    for (const artwork of artworks) {
      if (steps.length - 1 >= MAX_ARTWORKS_PER_VISIT) break;

      const durationsForLevel = itemsByArtwork.get(artwork.wikidataId)?.get(profile.level);
      if (!durationsForLevel || durationsForLevel.size === 0) continue;

      steps.push({
        id: `artwork-${artwork.wikidataId}-${profile.key}`,
        order: order++,
        type: VisitStepType.ARTWORK,
        artworkId: artwork.wikidataId,
        itemIds: Array.from(durationsForLevel.values()),
        isOptional: false,
        estimatedDuration: primarySeconds,
      });
      totalSeconds += primarySeconds + WALK_BUFFER_SECONDS;
    }

    const artworksCount = steps.filter((s) => s.type === VisitStepType.ARTWORK).length;

    if (artworksCount < MIN_ARTWORKS_PER_VISIT) {
      console.log(
        `   ⚠️  "${title}": solo ${artworksCount} opere con contenuto al livello ${profile.level} (minimo ${MIN_ARTWORKS_PER_VISIT}), salto`,
      );
      continue;
    }

    steps.push({
      id: `logistic-outro-${profile.key}`,
      order: order++,
      type: VisitStepType.LOGISTIC,
      logisticTitle: 'Informazioni pratiche',
      logisticText:
        museum.services?.accessibility ||
        'Grazie per averci visitato! Vi aspettiamo per una prossima visita.',
      logisticIcon: 'accessibility',
      isOptional: true,
    });

    const estimatedMinutes = Math.max(15, Math.round(totalSeconds / 60));
    const authorId = authorIds[profileIndex % authorIds.length];
    const totalItemsCount = steps.reduce((sum, step) => sum + (step.itemIds?.length ?? 0), 0);

    await VisitModel.create({
      museumId: museum.wikidataId,
      authorId,
      title,
      description: `Visita guidata alla ${museum.name}: ${profile.descriptionHint}. ${artworksCount} opere selezionate lungo il percorso.`,
      steps,
      generalInfo: {
        ticketInfo: museum.services?.ticketInfo,
        openingHours: museum.services?.openingHours,
        services: museum.services?.services,
        accessibility: museum.services?.accessibility,
        wheelchairAccessible: museum.services?.wheelchairAccessible,
      },
      targetAudience: {
        minAge: profile.minAge,
        maxAge: profile.maxAge,
        languageLevels: [profile.level],
        estimatedDuration: estimatedMinutes,
      },
      metadata: {
        language: 'it',
        artworksCount,
        totalItemsCount,
        estimatedDuration: estimatedMinutes,
        price: 0,
        isFree: true,
        license: LicenseType.CC0,
        downloadsCount: 0,
        purchasesCount: 0,
      },
      isPublished: true,
      publishedAt: new Date(),
    });

    createdCount += 1;
    console.log(`   ✅  "${title}" creata: ${artworksCount} opere, ~${estimatedMinutes} min`);
  }

  return createdCount;
}

async function main() {
  await connectDB();

  const authorIds = await resolveAuthorIds();
  const museums = await MuseumModel.find({}).select('_id name wikidataId services').lean();

  console.log(`🏛️  ${museums.length} musei trovati\n`);

  let totalCreated = 0;
  for (const museum of museums as unknown as MuseumLean[]) {
    console.log(`— ${museum.name} (${museum.wikidataId})`);
    totalCreated += await generateVisitsForMuseum(museum, authorIds);
  }

  console.log(`\n🎉 Completato: ${totalCreated} visite create in totale.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ generate-visits fallito:', error);
    process.exit(1);
  });
