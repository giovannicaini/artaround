/**
 * Seed minimale: il necessario perché l'app funzioni da zero — i 7 account
 * di test e la configurazione globale del Navigator — senza musei, opere,
 * item o visite (quelli si aggiungono dopo, con seed-borghese.ts o a mano
 * dal Marketplace). Idempotente: non tocca ciò che esiste già.
 */
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { connectDB } from '../../apps/server/src/config/database.js';
import { User, NavigatorConfigModel } from '../../apps/server/src/models/index.js';
import { DEFAULT_NAVIGATOR_CONFIG } from '@artaround/shared';

type SeedOptions = {
  connect?: boolean;
  exitOnComplete?: boolean;
};

// I 7 account standard usati in questo progetto — stessa password per
// tutti, comoda per il pannello "Utenti di test" nel login del Marketplace.
const SEED_USERS: Array<{ username: string; email: string; isAdmin: boolean }> = [
  { username: 'admin', email: 'admin@artaround.app', isAdmin: true },
  { username: 'curatore1', email: 'curatore1@artaround.app', isAdmin: false },
  { username: 'curatore2', email: 'curatore2@artaround.app', isAdmin: false },
  { username: 'autore1', email: 'autore1@artaround.app', isAdmin: false },
  { username: 'autore2', email: 'autore2@artaround.app', isAdmin: false },
  { username: 'visitatore1', email: 'visitatore1@artaround.app', isAdmin: false },
  { username: 'visitatore2', email: 'visitatore2@artaround.app', isAdmin: false },
];

export async function seedMinimal(options: SeedOptions = {}): Promise<void> {
  const { connect = true, exitOnComplete = true } = options;

  try {
    console.log('🌱 Seed minimale: utenti + configurazione Navigator...\n');

    if (connect) {
      await connectDB();
    }

    console.log('👥 Utenti...');
    const hashedPassword = await bcrypt.hash('12345678', 10);
    let usersCreated = 0;

    for (const user of SEED_USERS) {
      const existing = await User.findOne({ username: user.username }).select('_id').lean();
      if (existing) {
        console.log(`   ⏭️  ${user.username} già esistente, non toccato`);
        continue;
      }
      await User.create({ ...user, password: hashedPassword, isActive: true });
      usersCreated += 1;
      console.log(`   ✅ ${user.username} creato`);
    }

    console.log('\n🧭 Configurazione globale del Navigator...');
    const existingGlobal = await NavigatorConfigModel.findOne({ applicability: 'global' })
      .select('_id')
      .lean();

    let navigatorConfigCreated = false;
    if (existingGlobal) {
      console.log('   ⏭️  Configurazione globale già esistente, non toccata');
    } else {
      await NavigatorConfigModel.create(DEFAULT_NAVIGATOR_CONFIG);
      navigatorConfigCreated = true;
      console.log('   ✅ Configurazione globale creata');
    }

    console.log(
      `\n✅ Seed minimale completato — utenti creati: ${usersCreated}/${SEED_USERS.length}, configurazione Navigator: ${navigatorConfigCreated ? 'creata' : 'già presente'}`,
    );

    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Seed minimale fallito:', error);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw error;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const entrypointFile = process.argv[1];

if (entrypointFile && currentFile === entrypointFile) {
  void seedMinimal();
}
