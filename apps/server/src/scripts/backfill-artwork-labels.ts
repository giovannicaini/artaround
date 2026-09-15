/**
 * Risolve nome autore/movimento sulle opere che ne sono prive pur avendo già l'ID Wikidata.
 */
// backfill-artwork-labels.ts
//
// Risolve nome autore/movimento su Artwork quando manca (o è rimasto il
// placeholder "Autore sconosciuto") pur avendo già l'ID Wikidata salvato —
// capita quando l'import originale non è riuscito a recuperare la label.
// Scoperto per le opere effettivamente usate nelle visite pubblicate; usa
// WikidataService.getEntity, stessa fonte già usata altrove nell'app.
//
// Uso:
//   npx tsx src/scripts/backfill-artwork-labels.ts [--dry-run]

import { connectDB } from '../config/database.js';
import { ArtworkModel, VisitModel } from '../models/index.js';
import { VisitStepType } from '@artaround/shared';
import { WikidataService } from '../utils/wikidata.service.js';

const UNKNOWN_AUTHOR = 'Autore sconosciuto';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const visits = await VisitModel.find({}).select('steps').lean();
  const artworkIds = new Set<string>();
  for (const visit of visits) {
    for (const step of visit.steps || []) {
      if (step.type === VisitStepType.ARTWORK && step.artworkId) {
        artworkIds.add(step.artworkId);
      }
    }
  }

  const artworks = await ArtworkModel.find({ wikidataId: { $in: [...artworkIds] } });
  console.log(`Opere in visite pubblicate: ${artworks.length}`);

  const authorQidsToResolve = new Set<string>();
  const movementQidsToResolve = new Set<string>();
  for (const artwork of artworks) {
    if (artwork.authorWikidataId && (!artwork.author || artwork.author === UNKNOWN_AUTHOR)) {
      authorQidsToResolve.add(artwork.authorWikidataId);
    }
    if (artwork.movementWikidataId && !artwork.movement) {
      movementQidsToResolve.add(artwork.movementWikidataId);
    }
  }

  console.log(
    `Autori da risolvere: ${authorQidsToResolve.size} — Movimenti da risolvere: ${movementQidsToResolve.size}`,
  );

  const resolvedLabels = new Map<string, string>();
  for (const qid of [...authorQidsToResolve, ...movementQidsToResolve]) {
    try {
      const entity = await WikidataService.getEntity(qid);
      if (entity?.label && entity.label !== qid) {
        resolvedLabels.set(qid, entity.label);
        console.log(`  ${qid} → ${entity.label}`);
      } else {
        console.log(`  ${qid} → nessuna label trovata`);
      }
    } catch (error) {
      console.log(`  ${qid} → errore: ${(error as Error).message}`);
    }
    await sleep(300);
  }

  let authorsUpdated = 0;
  let movementsUpdated = 0;
  for (const artwork of artworks) {
    const authorLabel = artwork.authorWikidataId
      ? resolvedLabels.get(artwork.authorWikidataId)
      : undefined;
    const movementLabel = artwork.movementWikidataId
      ? resolvedLabels.get(artwork.movementWikidataId)
      : undefined;

    if (authorLabel && (!artwork.author || artwork.author === UNKNOWN_AUTHOR)) {
      if (!dryRun) artwork.author = authorLabel;
      authorsUpdated++;
    }
    if (movementLabel && !artwork.movement) {
      if (!dryRun) artwork.movement = movementLabel;
      movementsUpdated++;
    }
    if (!dryRun && artwork.isModified()) await artwork.save();
  }

  console.log(
    `\n[${dryRun ? 'DRY-RUN' : 'APPLY'}] Autori aggiornati: ${authorsUpdated} — Movimenti aggiornati: ${movementsUpdated}`,
  );
  process.exit(0);
}

run().catch((error) => {
  console.error('Backfill fallito:', error);
  process.exit(1);
});
