/**
 * Seed di sviluppo: crea un set minimo di dati (utenti, museo, opere) per lavorare in locale senza un dump reale.
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { spawn } from 'child_process';
import mongoose from 'mongoose';
import { seedDatabase as seedBaseDatabase } from '../../apps/server/src/scripts/seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Cartella apps/server: gli altri script vengono lanciati da lì, come "npm run seed:*".
const serverRoot = path.resolve(__dirname, '../../apps/server');

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: serverRoot,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} failed with code ${code ?? 'unknown'}`));
      }
    });
  });
}

export async function seedNewDatabase(): Promise<void> {
  try {
    console.log('🌱 Starting integrated seed (base + Borghese + Uffizi)...\n');

    await seedBaseDatabase({ connect: true, exitOnComplete: false });

    console.log('\n🏛️ Running Borghese seed...\n');
    await runCommand('npx', ['tsx', '../../scripts/server/seed-borghese.ts']);

    console.log('\n🏛️ Running Uffizi seed...\n');
    await runCommand('npx', [
      'tsx',
      '../../scripts/server/seed-borghese.ts',
      '--seed-file',
      'seed-uffizi.json',
      '--cache-file',
      'seed-uffizi.items-cache.v2.json',
    ]);

    console.log('\n✅ Integrated seed completed successfully!');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);
const entrypointFile = process.argv[1];

if (entrypointFile && currentFile === entrypointFile) {
  seedNewDatabase().catch((error) => {
    console.error('❌ Integrated seed failed:', error);
    process.exit(1);
  });
}
