import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root directory
// Use .env as main file (can be a symlink to .env.development or .env.production)
dotenv.config({ path: path.resolve(process.cwd(), '../../', '.env') });

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
