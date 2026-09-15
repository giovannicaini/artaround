/*
 * File: /src/scripts/db-dump.mjs                                                        *
 * Project: @artaround/server                                                            *
 * Last Modified: 15/09/2026                                                             *
 * Author: Giovanni Caini (giovanni.caini@studio.unibo.it)                               *
 * -----                                                                                 *
 * MIT License                                                                           *
 *                                                                                       *
 * Copyright (c) 2026 Giovanni Caini                                                     *
 *                                                                                       *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of       *
 * this software and associated documentation files (the "Software"), to deal in         *
 * the Software without restriction, including without limitation the rights to          *
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies         *
 * of the Software, and to permit persons to whom the Software is furnished to do        *
 * so, subject to the following conditions:                                              *
 *                                                                                       *
 * The above copyright notice and this permission notice shall be included in all        *
 * copies or substantial portions of the Software.                                       *
 *                                                                                       *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR            *
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,              *
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE           *
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER                *
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,         *
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE         *
 * SOFTWARE.                                                                             *
 * ************************************************************************************* *
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { EJSON } from 'bson';

// Esporta ogni collection del DB sorgente in un file JSON (Extended JSON
// "canonico", non "relaxed": preserva ObjectId/Date/Decimal128/... esatti,
// non le loro approssimazioni testuali) — alternativa pura Node/driver a
// mongodump, per ambienti dove i MongoDB Database Tools non sono installabili
// (vedi scripts/db-restore.mjs per il lato opposto).
//
// Uso:
//   node scripts/db-dump.mjs --uri="mongodb://localhost:27017/artaround_dev" --out=./db-dump

function parseArgs(argv) {
  const args = { uri: process.env.MONGODB_URI, out: './db-dump' };
  for (const part of argv) {
    if (part.startsWith('--uri=')) args.uri = part.slice('--uri='.length);
    else if (part.startsWith('--out=')) args.out = part.slice('--out='.length);
  }
  return args;
}

async function main() {
  const { uri, out } = parseArgs(process.argv.slice(2));
  if (!uri) throw new Error('Serve --uri=<mongodb-uri> (o la variabile MONGODB_URI)');

  await fs.mkdir(out, { recursive: true });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  console.log(`Trovate ${collections.length} collection in ${db.databaseName}`);

  for (const { name } of collections) {
    const docs = await db.collection(name).find({}).toArray();
    const filePath = path.join(out, `${name}.json`);
    await fs.writeFile(filePath, EJSON.stringify(docs, { relaxed: false }), 'utf-8');

    // Indici (unique, testo, composti...) — esclude "_id_", sempre creato
    // in automatico e non ricreabile esplicitamente via createIndexes.
    const indexes = (await db.collection(name).indexes()).filter((idx) => idx.name !== '_id_');
    const indexFilePath = path.join(out, `${name}.indexes.json`);
    await fs.writeFile(indexFilePath, EJSON.stringify(indexes, { relaxed: false }), 'utf-8');

    console.log(`  ${name}: ${docs.length} documenti, ${indexes.length} indici -> ${filePath}`);
  }

  await client.close();
  console.log(`Dump completato in ${out}`);
}

main().catch((error) => {
  console.error('db-dump fallito:', error.message);
  process.exitCode = 1;
});
