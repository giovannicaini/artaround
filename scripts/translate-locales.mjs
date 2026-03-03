import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const localesDir = path.join(root, 'packages', 'shared', 'src', 'locales');
const baseLang = 'it';
const targetLangs = ['en', 'fr', 'de', 'es'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sortObject(obj) {
  return Object.keys(obj)
    .sort((a, b) => a.localeCompare(b, 'it'))
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {});
}

async function translateText(text, targetLang) {
  const query = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=it&tl=${targetLang}&dt=t&q=${query}`;

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const translated = data?.[0]
        ?.map((entry) => entry?.[0] || '')
        .join('')
        .trim();
      if (!translated) {
        throw new Error('Empty translation');
      }

      return translated;
    } catch (error) {
      lastError = error;
      await sleep(250 * attempt);
    }
  }

  throw lastError || new Error('Unknown translation error');
}

async function main() {
  const basePath = path.join(localesDir, `${baseLang}.json`);
  const base = JSON.parse(await fs.readFile(basePath, 'utf-8'));
  const baseKeys = Object.keys(base);

  for (const lang of targetLangs) {
    const localePath = path.join(localesDir, `${lang}.json`);
    const locale = JSON.parse(await fs.readFile(localePath, 'utf-8'));

    let translatedCount = 0;
    for (const key of baseKeys) {
      const current = String(locale[key] ?? '').trim();
      if (current) {
        continue;
      }

      const source = String(base[key] ?? '').trim();
      if (!source) {
        locale[key] = '';
        continue;
      }

      const translated = await translateText(source, lang);
      locale[key] = translated;
      translatedCount += 1;

      if (translatedCount % 25 === 0) {
        console.log(`${lang}: translated ${translatedCount} entries...`);
      }

      await sleep(70);
    }

    await fs.writeFile(localePath, `${JSON.stringify(sortObject(locale), null, 2)}\n`, 'utf-8');
    console.log(`${lang}: completed, translated ${translatedCount} missing entries.`);
  }
}

main().catch((error) => {
  console.error('Locale translation failed:', error.message || String(error));
  process.exitCode = 1;
});
