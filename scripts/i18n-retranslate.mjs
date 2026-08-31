import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const localesDir = path.join(workspaceRoot, 'packages', 'shared', 'src', 'locales');

const SOURCE_LANG = 'it';
const DEFAULT_TARGETS = ['en', 'fr', 'de', 'es'];
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_CHUNK_SIZE = 80;
const DEFAULT_TEMPERATURE = 0.2;

const APP_CONTEXT = `
ArtAround is a multilingual web platform for museum management and visitor experiences.
Main domains:
- Marketplace admin panel for museum staff (admins, curators, authors)
- Museum configuration, navigator app configuration, items, artworks, guided visits
- Accessibility settings and UX controls

Translation style requirements:
- UI copy, concise and clear (buttons, labels, placeholders, warnings)
- Keep tone professional and friendly
- Prefer domain-correct meaning over literal translation
- Keep capitalization appropriate for UI labels
`;

const GLOSSARY_BY_LANG = {
  en: {
    ArtAround: 'ArtAround',
    Marketplace: 'Marketplace',
    Navigator: 'Navigator',
    Wikidata: 'Wikidata',
    Curatore: 'Curator',
    Autore: 'Author',
    Museo: 'Museum',
    Visita: 'Visit',
    Contenuto: 'Content',
    Opera: 'Artwork',
  },
  fr: {
    ArtAround: 'ArtAround',
    Marketplace: 'Marketplace',
    Navigator: 'Navigator',
    Wikidata: 'Wikidata',
    Curatore: 'Conservateur',
    Autore: 'Auteur',
    Museo: 'Musée',
    Visita: 'Visite',
    Contenuto: 'Contenu',
    Opera: 'Œuvre',
  },
  de: {
    ArtAround: 'ArtAround',
    Marketplace: 'Marketplace',
    Navigator: 'Navigator',
    Wikidata: 'Wikidata',
    Curatore: 'Kurator',
    Autore: 'Autor',
    Museo: 'Museum',
    Visita: 'Besuch',
    Contenuto: 'Inhalt',
    Opera: 'Werk',
  },
  es: {
    ArtAround: 'ArtAround',
    Marketplace: 'Marketplace',
    Navigator: 'Navigator',
    Wikidata: 'Wikidata',
    Curatore: 'Curador',
    Autore: 'Autor',
    Museo: 'Museo',
    Visita: 'Visita',
    Contenuto: 'Contenido',
    Opera: 'Obra',
  },
};

function parseArgs(argv) {
  const args = {
    targets: [...DEFAULT_TARGETS],
    dryRun: false,
    chunkSize: DEFAULT_CHUNK_SIZE,
    model: DEFAULT_MODEL,
    overwrite: true,
  };

  for (const part of argv) {
    if (part === '--dry-run') args.dryRun = true;
    else if (part === '--no-overwrite') args.overwrite = false;
    else if (part.startsWith('--targets=')) {
      const values = part
        .split('=')[1]
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length > 0) args.targets = values;
    } else if (part.startsWith('--chunk-size=')) {
      const value = Number(part.split('=')[1]);
      if (Number.isFinite(value) && value > 0) args.chunkSize = Math.floor(value);
    } else if (part.startsWith('--model=')) {
      const value = part.split('=')[1]?.trim();
      if (value) args.model = value;
    }
  }

  return args;
}

function buildGlossaryText(targetLang) {
  const glossary = GLOSSARY_BY_LANG[targetLang] || {};
  const entries = Object.entries(glossary);
  if (entries.length === 0) return '(no glossary entries)';
  return entries.map(([source, target]) => `- ${source} => ${target}`).join('\n');
}

function extractPlaceholders(text) {
  const regex = /(\{[^}]+\}|%\d*\$?[sd]|:[a-zA-Z_][a-zA-Z0-9_]*)/g;
  return (text.match(regex) || []).sort();
}

function samePlaceholders(source, target) {
  const a = extractPlaceholders(source);
  const b = extractPlaceholders(target);
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readLocale(language) {
  const filePath = path.join(localesDir, `${language}.json`);
  const content = await fs.readFile(filePath, 'utf8');
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

async function writeLocale(language, data) {
  const filePath = path.join(localesDir, `${language}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(sortObjectByKey(data), null, 2)}\n`, 'utf8');
}

function chunkArray(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}

async function callOpenAI({ apiKey, model, system, user }) {
  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      temperature: DEFAULT_TEMPERATURE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenAI response empty');
  }

  const trimmed = content.trim();
  const jsonCandidate = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed;

  return JSON.parse(jsonCandidate);
}

async function translateChunk({ apiKey, model, targetLang, entries }) {
  const system = `
You are a senior software localization specialist.
Translate UI strings from Italian to ${targetLang}.
Use the provided app context and glossary strictly.
Preserve placeholders exactly (e.g. {name}, %s, :id).
Do not translate product/brand names if glossary says so.
Return only valid JSON, no markdown.
`;

  const user = `
APP CONTEXT:
${APP_CONTEXT}

GLOSSARY:
${buildGlossaryText(targetLang)}

TASK:
Translate these key/value pairs from Italian to ${targetLang}.
Keys must remain unchanged.

INPUT:
${JSON.stringify(entries, null, 2)}

OUTPUT FORMAT (JSON):
{
  "translations": [
    { "key": "...", "translatedText": "..." }
  ]
}
`;

  const result = await callOpenAI({ apiKey, model, system, user });
  const list = Array.isArray(result?.translations) ? result.translations : [];

  const out = {};
  for (const item of list) {
    if (!item || typeof item.key !== 'string' || typeof item.translatedText !== 'string') continue;
    out[item.key] = item.translatedText.trim();
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY in environment');
  }

  const sourceLocale = await readLocale(SOURCE_LANG);
  const sourceEntries = Object.entries(sourceLocale).map(([key, text]) => ({
    key,
    text: String(text ?? ''),
  }));
  const chunks = chunkArray(sourceEntries, args.chunkSize);

  for (const targetLang of args.targets) {
    const targetLocale = await readLocale(targetLang);
    const nextLocale = { ...targetLocale };
    const warnings = [];

    console.log(`\n→ Translating ${SOURCE_LANG} -> ${targetLang} (${sourceEntries.length} keys)`);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const translatedMap = await translateChunk({
        apiKey,
        model: args.model,
        targetLang,
        entries: chunk,
      });

      for (const { key, text: sourceText } of chunk) {
        const candidate = translatedMap[key];
        if (!candidate) {
          warnings.push(`[${targetLang}] missing translation for key: ${key}`);
          continue;
        }

        if (!samePlaceholders(sourceText, candidate)) {
          warnings.push(`[${targetLang}] placeholder mismatch for key: ${key}`);
          continue;
        }

        if (args.overwrite || !nextLocale[key]) {
          nextLocale[key] = candidate;
        }
      }

      console.log(`  chunk ${index + 1}/${chunks.length} done`);
    }

    if (args.dryRun) {
      console.log(`  [dry-run] skipped write for ${targetLang}.json`);
    } else {
      await writeLocale(targetLang, nextLocale);
      console.log(`  wrote ${targetLang}.json`);
    }

    if (warnings.length > 0) {
      console.log(`  warnings (${warnings.length}):`);
      warnings.slice(0, 20).forEach((warning) => console.log(`   - ${warning}`));
      if (warnings.length > 20) {
        console.log(`   - ...and ${warnings.length - 20} more`);
      }
    }
  }

  console.log('\nLocale retranslation completed.');
}

main().catch((error) => {
  console.error('i18n retranslation failed:', error.message || String(error));
  process.exitCode = 1;
});
