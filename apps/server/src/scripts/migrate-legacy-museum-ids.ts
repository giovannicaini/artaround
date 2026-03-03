import { connectDB } from '../config/database.js';
import { ArtworkModel, ItemModel, MuseumModel, VisitModel } from '../models/index.js';

type ScriptOptions = {
  dryRun: boolean;
};

type MigrationResult = {
  collection: string;
  matched: number;
  modified: number;
};

function parseArgs(argv: string[]): ScriptOptions {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

async function runCollectionMigration(
  collection: 'artworks' | 'items' | 'visits',
  wikidataId: string,
  mongoMuseumId: string,
  dryRun: boolean,
): Promise<MigrationResult> {
  let matched = 0;
  let modified = 0;

  if (collection === 'artworks') {
    matched = await ArtworkModel.countDocuments({ museumId: wikidataId });
    if (!dryRun && matched > 0) {
      const result = await ArtworkModel.updateMany(
        { museumId: wikidataId },
        { $set: { museumId: mongoMuseumId } },
      );
      modified = result.modifiedCount;
    }
  }

  if (collection === 'items') {
    matched = await ItemModel.countDocuments({ museumId: wikidataId });
    if (!dryRun && matched > 0) {
      const result = await ItemModel.updateMany(
        { museumId: wikidataId },
        { $set: { museumId: mongoMuseumId } },
      );
      modified = result.modifiedCount;
    }
  }

  if (collection === 'visits') {
    matched = await VisitModel.countDocuments({ museumId: wikidataId });
    if (!dryRun && matched > 0) {
      const result = await VisitModel.updateMany(
        { museumId: wikidataId },
        { $set: { museumId: mongoMuseumId } },
      );
      modified = result.modifiedCount;
    }
  }

  return {
    collection,
    matched,
    modified,
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  await connectDB();

  const museums = await MuseumModel.find({}).select('_id wikidataId name').lean();
  const wikidataToMongo = new Map<string, { _id: string; name: string }>();
  for (const museum of museums) {
    if (museum.wikidataId) {
      wikidataToMongo.set(museum.wikidataId, {
        _id: String(museum._id),
        name: museum.name,
      });
    }
  }

  const legacyArtworkIds = (await ArtworkModel.distinct('museumId')).filter(
    (id): id is string => typeof id === 'string' && id.startsWith('Q'),
  );
  const legacyItemIds = (await ItemModel.distinct('museumId')).filter(
    (id): id is string => typeof id === 'string' && id.startsWith('Q'),
  );
  const legacyVisitIds = (await VisitModel.distinct('museumId')).filter(
    (id): id is string => typeof id === 'string' && id.startsWith('Q'),
  );

  const legacyMuseumIds = Array.from(
    new Set([...legacyArtworkIds, ...legacyItemIds, ...legacyVisitIds]),
  );

  if (legacyMuseumIds.length === 0) {
    console.log('Nessun museumId legacy (Wikidata) trovato in artworks/items/visits');
    process.exit(0);
  }

  const unresolvedLegacyIds: string[] = [];
  const results: MigrationResult[] = [];

  for (const legacyId of legacyMuseumIds) {
    const mapped = wikidataToMongo.get(legacyId);

    if (!mapped) {
      unresolvedLegacyIds.push(legacyId);
      continue;
    }

    const collections: Array<'artworks' | 'items' | 'visits'> = ['artworks', 'items', 'visits'];
    for (const collection of collections) {
      const result = await runCollectionMigration(collection, legacyId, mapped._id, options.dryRun);
      if (result.matched > 0) {
        results.push(result);
      }
    }

    console.log(
      `[${options.dryRun ? 'DRY-RUN' : 'APPLY'}] ${legacyId} (${mapped.name}) -> ${mapped._id}`,
    );
  }

  console.log('\n=== Risultati migrazione museumId legacy ===');
  for (const result of results) {
    console.log(
      `${result.collection}: matched=${result.matched}, modified=${
        options.dryRun ? result.matched : result.modified
      }`,
    );
  }

  if (results.length === 0) {
    console.log('Nessun documento da migrare.');
  }

  if (unresolvedLegacyIds.length > 0) {
    console.log(`\nLegacy IDs senza mapping museo: ${unresolvedLegacyIds.join(', ')}`);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Migrazione fallita:', error);
  process.exit(1);
});
