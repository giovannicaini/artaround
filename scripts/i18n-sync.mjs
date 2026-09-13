import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const localesDir = path.join(workspaceRoot, 'packages', 'shared', 'src', 'locales');
const baseLanguage = 'it';

const includeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.html']);
const excludeDirNames = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.turbo',
  '.next',
  'coverage',
  'uploads',
  'tmp',
]);

const callPatterns = [
  /__\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)/g,
  /i18nService\.t\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)/g,
  // Navigator (apps/navigator): const t = useT(); t('...') — \b prima di "t("
  // evita falsi positivi (verificato: nessun'altra funzione chiamata "t" nel
  // resto del monorepo, get(/set(/sort( non hanno un confine di parola prima
  // della "t").
  /\bt\(\s*(['"`])((?:\\.|(?!\1).)*)\1\s*\)/g,
];

const unescapeString = (value) =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\`/g, '`')
    .replace(/\\\\/g, '\\');

async function listLocaleLanguages() {
  const entries = await fs.readdir(localesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name.replace(/\.json$/, ''))
    .sort();
}

async function walkDirectory(rootPath, outFiles) {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirNames.has(entry.name)) {
        continue;
      }
      await walkDirectory(fullPath, outFiles);
      continue;
    }

    const extension = path.extname(entry.name);
    if (includeExtensions.has(extension)) {
      outFiles.push(fullPath);
    }
  }
}

function extractTranslationTexts(content) {
  const found = new Set();

  for (const pattern of callPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const quote = match[1];
      const rawText = match[2];
      if (!rawText || rawText.includes('${')) {
        continue;
      }

      const normalized = unescapeString(rawText).trim();
      if (!normalized) {
        continue;
      }

      if (quote === '`' && normalized.includes('\n')) {
        continue;
      }

      found.add(normalized);
    }
  }

  return found;
}

async function readLocaleFile(language) {
  const filePath = path.join(localesDir, `${language}.json`);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

function sortObjectByKey(record) {
  return Object.keys(record)
    .sort((a, b) => a.localeCompare(b, 'it'))
    .reduce((accumulator, key) => {
      accumulator[key] = record[key];
      return accumulator;
    }, {});
}

async function writeLocaleFile(language, values) {
  const filePath = path.join(localesDir, `${language}.json`);
  const sorted = sortObjectByKey(values);
  await fs.writeFile(filePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf-8');
}

async function main() {
  const languages = await listLocaleLanguages();
  if (!languages.includes(baseLanguage)) {
    throw new Error(`Base locale '${baseLanguage}.json' not found in ${localesDir}`);
  }

  const localeByLanguage = {};
  for (const language of languages) {
    localeByLanguage[language] = await readLocaleFile(language);
  }

  const filesToScan = [];
  await walkDirectory(path.join(workspaceRoot, 'apps'), filesToScan);
  await walkDirectory(path.join(workspaceRoot, 'packages'), filesToScan);

  const discoveredTexts = new Set();
  for (const filePath of filesToScan) {
    const content = await fs.readFile(filePath, 'utf-8');
    for (const text of extractTranslationTexts(content)) {
      discoveredTexts.add(text);
    }
  }

  const baseLocale = localeByLanguage[baseLanguage];
  let addedToBase = 0;
  for (const text of discoveredTexts) {
    if (!Object.hasOwn(baseLocale, text)) {
      baseLocale[text] = text;
      addedToBase += 1;
    }
  }

  const baseKeys = Object.keys(baseLocale);
  const changes = { [baseLanguage]: addedToBase };

  for (const language of languages) {
    if (language === baseLanguage) {
      continue;
    }

    const locale = localeByLanguage[language];
    let added = 0;
    for (const key of baseKeys) {
      if (!Object.hasOwn(locale, key)) {
        locale[key] = '';
        added += 1;
      }
    }
    changes[language] = added;
  }

  for (const language of languages) {
    await writeLocaleFile(language, localeByLanguage[language]);
  }

  const summary = Object.entries(changes)
    .map(([language, count]) => `${language}: +${count}`)
    .join(', ');

  console.log(`i18n sync completed. Files scanned: ${filesToScan.length}.`);
  console.log(`Keys discovered in code: ${discoveredTexts.size}.`);
  console.log(`Added keys -> ${summary}`);
}

main().catch((error) => {
  console.error('i18n sync failed:', error.message);
  process.exitCode = 1;
});
