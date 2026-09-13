import fs from 'node:fs/promises';
import path from 'node:path';
import { EJSON } from 'bson';
import mongoose from 'mongoose';

const BATCH_SIZE = 500;

function chunk<T>(array: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/**
 * Ripristina uno specchio esatto da un dump prodotto da scripts/db-dump.mjs,
 * usando la connessione mongoose già aperta (nessun nuovo MongoClient) —
 * pensato per ambienti dove il database è raggiungibile solo dall'app in
 * esecuzione, non da uno script esterno lanciato a mano (vedi config.restoreDump).
 *
 * Ogni collection trovata nella cartella viene svuotata e reinserita da zero,
 * indici compresi — mai verso un database con dati propri da preservare.
 */
export async function restoreDump(dir: string): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Connessione al database non ancora stabilita');

  let allFiles: string[];
  try {
    allFiles = await fs.readdir(dir);
  } catch {
    console.warn(`⚠️  Cartella dump non trovata: ${dir} — ripristino saltato`);
    return;
  }

  const files = allFiles.filter((f) => f.endsWith('.json') && !f.endsWith('.indexes.json'));
  if (files.length === 0) {
    console.warn(`⚠️  Nessun file .json trovato in ${dir} — ripristino saltato`);
    return;
  }

  console.log(`🔄 Ripristino ${files.length} collection da ${dir}...`);

  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    const raw = await fs.readFile(path.join(dir, file), 'utf-8');
    const docs = EJSON.parse(raw) as Record<string, unknown>[];

    const collection = db.collection(name);
    await collection.deleteMany({});
    for (const batch of chunk(docs, BATCH_SIZE)) {
      if (batch.length > 0) await collection.insertMany(batch, { ordered: false });
    }

    let indexCount = 0;
    try {
      const rawIndexes = await fs.readFile(path.join(dir, `${name}.indexes.json`), 'utf-8');
      const indexes = (EJSON.parse(rawIndexes) as Record<string, unknown>[]).map(
        ({ v: _v, ...spec }) => spec,
      );
      if (indexes.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- forma esatta definita dal driver, non serve tipizzarla qui
        await collection.createIndexes(indexes as any[]);
        indexCount = indexes.length;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    console.log(`  ${name}: ${docs.length} documenti, ${indexCount} indici ripristinati`);
  }

  console.log('✅ Ripristino completato');
}
