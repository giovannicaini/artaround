import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
// npm run dev -> .env.development
// npm run start (production) -> .env.production
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(process.cwd(), '../../', envFile) });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8000', 10),
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/artaround',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_secret_key_change_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as const,
  
  cors: {
    origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8000'],
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
};
