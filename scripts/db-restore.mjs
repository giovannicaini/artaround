import fs from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';

// Ripristina uno specchio esatto: per ogni file <collection>.json prodotto da
// db-dump.mjs, svuota la collection di destinazione (non la elimina: indici
// e validator restano) e reinserisce i documenti. Alternativa pura Node/
// driver a mongorestore, per ambienti dove i MongoDB Database Tools non sono
// installabili.
//
// ATTENZIONE: --drop implicito su ogni collection trovata nella cartella di
// input — usare solo verso un DB che deve rispecchiare esattamente il dump,
// mai verso uno con dati propri da preservare.
//
// Uso:
//   node scripts/db-restore.mjs --uri="mongodb://localhost:27017/artaround_dev" --in=./db-dump

const BATCH_SIZE = 500;

function parseArgs(argv) {
  const args = { uri: process.env.MONGODB_URI, in: './db-dump' };
  for (const part of argv) {
    if (part.startsWith('--uri=')) args.uri = part.slice('--uri='.length);
    else if (part.startsWith('--in=')) args.in = part.slice('--in='.length);
  }
  return args;
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

async function main() {
  const { uri, in: inputDir } = parseArgs(process.argv.slice(2));
  if (!uri) throw new Error('Serve --uri=<mongodb-uri> (o la variabile MONGODB_URI)');

  const allFiles = await fs.readdir(inputDir);
  // I file "<nome>.indexes.json" sono gli indici della collection <nome>, non
  // documenti — vanno esclusi qui dai file "documenti" (altrimenti verrebbero
  // ripristinati come una collection a parte chiamata "<nome>.indexes").
  const files = allFiles.filter((f) => f.endsWith('.json') && !f.endsWith('.indexes.json'));
  if (files.length === 0) throw new Error(`Nessun file .json trovato in ${inputDir}`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  console.log(`Ripristino ${files.length} collection su ${db.databaseName}`);

  for (const file of files) {
    const name = file.replace(/\.json$/, '');
    const raw = await fs.readFile(path.join(inputDir, file), 'utf-8');
    const docs = EJSON.parse(raw);

    const collection = db.collection(name);
    await collection.deleteMany({});
    for (const batch of chunk(docs, BATCH_SIZE)) {
      if (batch.length > 0) await collection.insertMany(batch, { ordered: false });
    }

    let indexCount = 0;
    const indexFile = path.join(inputDir, `${name}.indexes.json`);
    try {
      const rawIndexes = await fs.readFile(indexFile, 'utf-8');
      // "v" è la versione interna del formato indice: non va ripassata a
      // createIndexes, che la gestisce da sé.
      const indexes = EJSON.parse(rawIndexes).map(({ v, ...spec }) => spec);
      if (indexes.length > 0) {
        await collection.createIndexes(indexes);
        indexCount = indexes.length;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // file assente = nessun indice per questa collection
    }

    console.log(`  ${name}: ${docs.length} documenti, ${indexCount} indici ripristinati`);
  }

  await client.close();
  console.log('Ripristino completato');
}

main().catch((error) => {
  console.error('db-restore fallito:', error.message);
  process.exitCode = 1;
});
