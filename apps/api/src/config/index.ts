import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || 'localhost',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  apiVersion: process.env.API_VERSION || 'v1',

  // Database configuration
  databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'loanlens.db'),
  databaseVerbose: process.env.DATABASE_VERBOSE === 'true'
} as const;
