import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const srcRoot = path.join(root, 'apps', 'marketplace', 'src');

const includeExt = new Set(['.ts']);
const skipFiles = new Set(['i18n.service.ts']);

const italianHints = [
  'seleziona',
  'gestione',
  'caricamento',
  'impostazioni',
  'descrizione',
  'titolo',
  'museo',
  'visita',
  'visite',
  'contenuti',
  'contenuto',
  'opere',
  'opera',
  'errore',
  'successo',
  'crea',
  'modifica',
  'elimina',
  'utente',
  'acquisti',
  'lingua',
  'traduzione',
  'chiudi',
  'apri',
  'curatore',
  'dashboard',
  'mercato',
  'gratuito',
  'acquistato',
  'profilo',
  'accessibilità',
  'città',
  'paese',
  'annulla',
  'non ',
  ' già ',
  'sicuro',
  'obbligatorio',
];

const objectKeys = [
  'label',
  'title',
  'description',
  'message',
  'hint',
  'placeholder',
  'confirmLabel',
  'countLabel',
  'buttonLabel',
  'loadingText',
  'text',
];

const attrKeys = [
  'label',
  'title',
  'description',
  'message',
  'hint',
  'placeholder',
  'confirmLabel',
  'countLabel',
  'buttonLabel',
  'loadingText',
  'text',
  'aria-label',
];

function isLikelyItalian(value) {
  if (!value) return false;
  const raw = value.trim();
  if (!raw) return false;
  if (/^[a-z0-9_./:-]+$/i.test(raw)) return false;
  if (/[À-ÿ]/.test(raw)) return true;
  const lower = ` ${raw.toLowerCase()} `;
  return italianHints.some((hint) => lower.includes(hint));
}

function quoteEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist'].includes(entry.name)) continue;
      await walk(full, out);
      continue;
    }
    if (includeExt.has(path.extname(entry.name)) && !skipFiles.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function applyReplacements(content) {
  let updated = content;
  let changes = 0;

  for (const key of objectKeys) {
    const regex = new RegExp(`(${key}\\s*:\\s*)'([^'\\n]+)'`, 'g');
    updated = updated.replace(regex, (m, p1, text) => {
      if (!isLikelyItalian(text)) return m;
      if (text.includes('${')) return m;
      changes += 1;
      return `${p1}__('${quoteEscape(text)}')`;
    });

    const regexDq = new RegExp(`(${key}\\s*:\\s*)\"([^\"\\n]+)\"`, 'g');
    updated = updated.replace(regexDq, (m, p1, text) => {
      if (!isLikelyItalian(text)) return m;
      if (text.includes('${')) return m;
      changes += 1;
      return `${p1}__('${quoteEscape(text)}')`;
    });
  }

  for (const key of attrKeys) {
    const regex = new RegExp(`(\\s)${key}=\"([^\"\\n]+)\"`, 'g');
    updated = updated.replace(regex, (m, ws, text) => {
      if (!isLikelyItalian(text)) return m;
      if (text.includes('${')) return m;
      changes += 1;
      if (key === 'aria-label') {
        return `${ws}aria-label=\${__('${quoteEscape(text)}')}`;
      }
      return `${ws}.${key}=\${__('${quoteEscape(text)}')}`;
    });
  }

  updated = updated.replace(/(this\.(?:error|success)\s*=\s*)'([^'\n]+)'/g, (m, p1, text) => {
    if (!isLikelyItalian(text)) return m;
    changes += 1;
    return `${p1}__('${quoteEscape(text)}')`;
  });

  updated = updated.replace(/(this\.(?:error|success)\s*=\s*)\"([^\"\n]+)\"/g, (m, p1, text) => {
    if (!isLikelyItalian(text)) return m;
    changes += 1;
    return `${p1}__('${quoteEscape(text)}')`;
  });

  return { updated, changes };
}

function ensureImport(filePath, content) {
  if (!content.includes('__(')) return content;
  if (
    content.includes("from '../../services/i18n.service'") ||
    content.includes("from '../services/i18n.service'") ||
    content.includes("from './services/i18n.service'")
  ) {
    return content;
  }

  const rel = path
    .relative(path.dirname(filePath), path.join(srcRoot, 'services', 'i18n.service'))
    .replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : `./${rel}`;

  const lines = content.split('\n');
  let insertAt = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith('import ')) insertAt = i;
  }
  if (insertAt >= 0) {
    lines.splice(insertAt + 1, 0, `import { __ } from '${importPath}';`);
    return lines.join('\n');
  }

  return `import { __ } from '${importPath}';\n${content}`;
}

async function main() {
  const files = await walk(srcRoot);
  let touchedFiles = 0;
  let totalChanges = 0;

  for (const filePath of files) {
    const original = await fs.readFile(filePath, 'utf-8');
    const { updated, changes } = applyReplacements(original);
    if (changes === 0) continue;

    const withImport = ensureImport(filePath, updated);
    if (withImport !== original) {
      await fs.writeFile(filePath, withImport, 'utf-8');
      touchedFiles += 1;
      totalChanges += changes;
    }
  }

  console.log(`i18nify completed. Files touched: ${touchedFiles}. Replacements: ${totalChanges}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
