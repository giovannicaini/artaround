import { connectDB } from '../config/database.js';
import { ArtworkModel, ItemModel } from '../models/index.js';
import { ItemReferenceType } from '@artaround/shared';

type ScriptOptions = {
  defaultMuseumId?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): ScriptOptions {
  const options: ScriptOptions = { dryRun: false };

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith('--default-museum-id=')) {
      options.defaultMuseumId = arg.split('=')[1];
    }
  }

  if (!options.defaultMuseumId && process.env.DEFAULT_MUSEUM_ID) {
    options.defaultMuseumId = process.env.DEFAULT_MUSEUM_ID;
  }

  return options;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  await connectDB();

  const artworkList = await ArtworkModel.find({}).select('wikidataId museumId').lean();
  const artworkMuseumMap = new Map<string, string>();
  for (const artwork of artworkList) {
    if (artwork.wikidataId && artwork.museumId) {
      artworkMuseumMap.set(artwork.wikidataId, artwork.museumId);
    }
  }

  const items = await ItemModel.find({
    $or: [{ museumId: { $exists: false } }, { museumId: null }, { museumId: '' }],
  }).lean();

  let updated = 0;
  let skipped = 0;
  let unresolved = 0;
  const unresolvedIds: string[] = [];

  for (const item of items) {
    let museumId: string | undefined;

    if (item.referenceType === ItemReferenceType.MUSEUM && item.referenceId) {
      museumId = item.referenceId;
    } else if (item.referenceType === ItemReferenceType.ARTWORK && item.referenceId) {
      museumId = artworkMuseumMap.get(item.referenceId);
    }

    if (!museumId && options.defaultMuseumId) {
      museumId = options.defaultMuseumId;
    }

    if (!museumId) {
      unresolved += 1;
      if (unresolvedIds.length < 20) {
        unresolvedIds.push(String(item._id));
      }
      continue;
    }

    if (options.dryRun) {
      updated += 1;
      continue;
    }

    await ItemModel.updateOne({ _id: item._id }, { $set: { museumId } });
    updated += 1;
  }

  skipped = items.length - updated - unresolved;

  console.log('Backfill item museumId complete');
  console.log(`Items scanned: ${items.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Unresolved: ${unresolved}`);
  console.log(`Skipped (already had museumId): ${skipped}`);
  if (unresolvedIds.length > 0) {
    console.log(`Unresolved sample IDs: ${unresolvedIds.join(', ')}`);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
