import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/database.js';
import { User } from '../models/index.js';
import { CompetenceLevel, LanguageLevel, TimePreference } from '@artaround/shared';

type SeedOptions = {
  connect?: boolean;
  exitOnComplete?: boolean;
};

type SeedUser = {
  username: string;
  email: string;
  isAdmin: boolean;
  isActive: true;
  profile?: {
    displayName: string;
    bio?: string;
    competenceLevel: CompetenceLevel;
    preferredLanguageLevel: LanguageLevel;
    timePreference: TimePreference;
  };
};

/**
 * Account richiesti dalle specifiche di progetto: "Nel marketplace sono già creati 4
 * account: autore1, autore2, visitatore1 e visitatore2, tutti con password 12345678."
 * "admin" è aggiuntivo, necessario per le funzionalità riservate all'amministratore.
 *
 * Non esiste un ruolo globale CURATOR/AUTHOR: autore1/autore2 vengono creati
 * come utenti non-admin — diventano curatori/autori di un museo specifico
 * solo se un admin (o il curatore di quel museo) li promuove via
 * MuseumController.addAuthor, es. quando si esegue seed-borghese.ts su un
 * museo reale.
 */
function getRequiredUsers(): SeedUser[] {
  return [
    {
      username: 'admin',
      email: 'admin@artaround.app',
      isAdmin: true,
      isActive: true,
    },
    {
      username: 'autore1',
      email: 'autore1@artaround.app',
      isAdmin: false,
      isActive: true,
      profile: {
        displayName: 'Autore 1',
        bio: 'Autore di contenuti culturali per musei e percorsi di visita.',
        competenceLevel: CompetenceLevel.AVANZATO,
        preferredLanguageLevel: LanguageLevel.MEDIUM,
        timePreference: TimePreference.NORMALE,
      },
    },
    {
      username: 'autore2',
      email: 'autore2@artaround.app',
      isAdmin: false,
      isActive: true,
      profile: {
        displayName: 'Autore 2',
        bio: 'Autrice/autore di contenuti culturali, focus su linguaggio divulgativo.',
        competenceLevel: CompetenceLevel.MEDIO,
        preferredLanguageLevel: LanguageLevel.ELEMENTARY,
        timePreference: TimePreference.NORMALE,
      },
    },
    {
      username: 'visitatore1',
      email: 'visitatore1@artaround.app',
      isAdmin: false,
      isActive: true,
      profile: {
        displayName: 'Visitatore 1',
        competenceLevel: CompetenceLevel.SEMPLICE,
        preferredLanguageLevel: LanguageLevel.ELEMENTARY,
        timePreference: TimePreference.VELOCE,
      },
    },
    {
      username: 'visitatore2',
      email: 'visitatore2@artaround.app',
      isAdmin: false,
      isActive: true,
      profile: {
        displayName: 'Visitatore 2',
        competenceLevel: CompetenceLevel.AVANZATO,
        preferredLanguageLevel: LanguageLevel.SPECIALIST,
        timePreference: TimePreference.APPROFONDITO,
      },
    },
  ];
}

export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const { connect = true, exitOnComplete = true } = options;

  try {
    console.log('🌱 Starting base seed (users only)...\n');

    if (connect) {
      await connectDB();
    }

    console.log('👥 Ensuring required users exist...');
    const hashedPassword = await bcrypt.hash('12345678', 10);

    let created = 0;
    let skipped = 0;

    for (const user of getRequiredUsers()) {
      const existing = await User.findOne({ username: user.username }).select('_id').lean();
      if (existing) {
        skipped += 1;
        console.log(`   ⏭️  ${user.username} già esistente, non toccato`);
        continue;
      }

      await User.create({ ...user, password: hashedPassword });
      created += 1;
      console.log(`   ✅  ${user.username} creato`);
    }

    console.log(`\n✅ Users ensured (creati: ${created}, già esistenti: ${skipped})\n`);
    console.log('🎉 Base seed completed successfully!');

    if (exitOnComplete) {
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Base seed failed:', error);
    if (exitOnComplete) {
      process.exit(1);
    }
    throw error;
  }
}

const currentFile = fileURLToPath(import.meta.url);
const entrypointFile = process.argv[1];

if (entrypointFile && currentFile === entrypointFile) {
  void seedDatabase();
}
