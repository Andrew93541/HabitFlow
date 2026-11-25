import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(serverRoot, '.env') });

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  PORT: Number(process.env.PORT) || 5001,
  NODE_ENV: nodeEnv,
  IS_PROD: nodeEnv === 'production',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  DB_PATH: process.env.DB_PATH
    ? resolve(serverRoot, process.env.DB_PATH)
    : resolve(serverRoot, 'data', 'habitflow.db'),
  BACKUP_DIR: process.env.BACKUP_DIR
    ? resolve(serverRoot, process.env.BACKUP_DIR)
    : resolve(serverRoot, 'backups'),
  AUTO_SEED: process.env.AUTO_SEED !== 'false',
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || 'habitflow_sid',
  SESSION_TTL_DAYS: Math.max(1, Number(process.env.SESSION_TTL_DAYS) || 14),
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || nodeEnv === 'production',
};
