import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { connectDB } from '../config/database.js';
import { User } from '../models/index.js';
import { UserRole, CompetenceLevel, LanguageLevel, TimePreference } from '@artaround/shared';

type SeedOptions = {
  connect?: boolean;
  exitOnComplete?: boolean;
};

export async function seedDatabase(options: SeedOptions = {}): Promise<void> {
  const { connect = true, exitOnComplete = true } = options;

  try {
    console.log('🌱 Starting base seed (users only)...\n');

    if (connect) {
      await connectDB();
    }

    console.log('🗑️ Clearing users...');
    await User.deleteMany({});
    console.log('✅ Users cleared\n');

    console.log('👥 Creating users...');
    const hashedPassword = await bcrypt.hash('12345678', 10);

    await User.create([
      {
        username: 'admin',
        email: 'admin@artaround.app',
        password: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
      },
      {
        username: 'autore1',
        email: 'autore1@artaround.app',
        password: hashedPassword,
        role: UserRole.AUTHOR,
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
        username: 'utente1',
        email: 'utente1@artaround.app',
        password: hashedPassword,
        role: UserRole.VISITOR,
        isActive: true,
        profile: {
          displayName: 'Utente 1',
          competenceLevel: CompetenceLevel.SEMPLICE,
          preferredLanguageLevel: LanguageLevel.ELEMENTARY,
          timePreference: TimePreference.VELOCE,
        },
      },
    ]);

    console.log('✅ Users created\n');
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
