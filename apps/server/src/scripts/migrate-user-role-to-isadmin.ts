import { connectDB } from '../config/database.js';
import { User } from '../models/index.js';

/**
 * User.role (stringa 'admin'/'visitor'/'curator'/'author', a seconda di quando
 * l'utente è stato creato) è stato sostituito da User.isAdmin (booleano) — non
 * esiste più un ruolo globale intermedio, essere curatore/autore è sempre
 * relativo a un museo specifico (User.museumRoles, non toccato da questa
 * migrazione). Senza questo script, ogni utente con role: 'admin' già salvato
 * perderebbe silenziosamente i permessi di amministratore al primo save
 * successivo al deploy (isAdmin assente -> default false).
 */

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

  const db = User.collection;
  const users = await db.find({ role: { $exists: true } }).toArray();

  let scanned = 0;
  let promoted = 0;
  let demoted = 0;

  for (const user of users) {
    scanned += 1;
    const isAdmin = user.role === 'admin';

    console.log(
      `[${options.dryRun ? 'DRY-RUN' : 'APPLY'}] ${user._id} (${user.username}): role="${user.role}" -> isAdmin=${isAdmin}`,
    );

    if (isAdmin) {
      promoted += 1;
    } else {
      demoted += 1;
    }

    if (!options.dryRun) {
      await db.updateOne({ _id: user._id }, { $set: { isAdmin }, $unset: { role: 1 } });
    }
  }

  console.log('\n=== Migrazione User.role -> User.isAdmin ===');
  console.log(`Scansionati: ${scanned}`);
  console.log(`Admin (isAdmin: true): ${promoted}`);
  console.log(`Non admin (isAdmin: false): ${demoted}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migrazione fallita:', error);
    process.exit(1);
  });
