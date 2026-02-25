import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables based on NODE_ENV
// npm run dev -> .env.development
// npm run start (production) -> .env.production
const envFile = process.env.NODE_ENV === 'development' ? '.env.development' : '.env.production';

const resolveEnvPath = (): string | undefined => {
  const envCandidates = [envFile, '.env'];
  let currentDir = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    for (const candidate of envCandidates) {
      const candidatePath = path.join(currentDir, candidate);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return undefined;
};

const envPath = resolveEnvPath();
const dotenvResult = envPath ? dotenv.config({ path: envPath }) : dotenv.config();

console.log(
  `[config] dotenv: NODE_ENV=${process.env.NODE_ENV || 'undefined'} cwd=${process.cwd()} envFile=${envPath || '(default)'} envDir=${envPath ? path.dirname(envPath) : process.cwd()}`,
);

if (dotenvResult.error) {
  console.warn(`[config] dotenv load error: ${dotenvResult.error.message}`);
}

const toBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
};

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/artaround_dev',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as const,

  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:8000',
    ],
  },

  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },

  wikidata: {
    apiUrl: process.env.WIKIDATA_API_URL || 'https://www.wikidata.org/w/api.php',
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB default
  },

  seed: {
    onStart: toBoolean(process.env.SEED_ON_START, true),
    onlyIfEmpty: toBoolean(process.env.SEED_ONLY_IF_EMPTY, true),
  },
};
