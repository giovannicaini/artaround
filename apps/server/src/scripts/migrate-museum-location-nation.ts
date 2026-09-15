/**
 * Migrazione: valorizza il campo nation nella location dei musei che ne sono privi.
 */
import { connectDB } from '../config/database.js';
import { MuseumModel } from '../models/index.js';

type ScriptOptions = {
  dryRun: boolean;
};

function parseArgs(argv: string[]): ScriptOptions {
  return {
    dryRun: argv.includes('--dry-run'),
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  await connectDB();

  const museums = await MuseumModel.find({}).select('_id name location').lean();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const museum of museums) {
    scanned += 1;

    const location = (museum.location || {}) as Record<string, unknown>;
    const nation = String(location.nation || location.country || '')
      .trim()
      .replace(/\s+/g, ' ');

    if (!nation) {
      skipped += 1;
      console.log(`[SKIP] ${museum._id} (${museum.name}): nation/country assente`);
      continue;
    }

    const setPayload: Record<string, unknown> = {};
    const unsetPayload: Record<string, unknown> = {};

    if (location.nation !== nation) {
      setPayload['location.nation'] = nation;
    }

    if (location.country !== nation) {
      setPayload['location.country'] = nation;
    }

    if (location.region !== undefined) {
      unsetPayload['location.region'] = 1;
    }

    if (Object.keys(setPayload).length === 0 && Object.keys(unsetPayload).length === 0) {
      continue;
    }

    if (!options.dryRun) {
      await MuseumModel.updateOne(
        { _id: museum._id },
        {
          ...(Object.keys(setPayload).length > 0 ? { $set: setPayload } : {}),
          ...(Object.keys(unsetPayload).length > 0 ? { $unset: unsetPayload } : {}),
        },
      );
    }

    updated += 1;
    console.log(
      `[${options.dryRun ? 'DRY-RUN' : 'APPLY'}] ${museum._id} (${museum.name}) -> nation="${nation}"`,
    );
  }

  console.log('\n=== Migrazione location museo ===');
  console.log(`Scansionati: ${scanned}`);
  console.log(`Aggiornati: ${updated}`);
  console.log(`Saltati (senza nation/country): ${skipped}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migrazione fallita:', error);
    process.exit(1);
  });
