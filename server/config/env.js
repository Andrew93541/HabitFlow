import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: resolve(serverRoot, '.env') });

export const env = {
  PORT: Number(process.env.PORT) || 5001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  DB_PATH: process.env.DB_PATH
    ? resolve(serverRoot, process.env.DB_PATH)
    : resolve(serverRoot, 'data', 'habitflow.db'),
  AUTO_SEED: process.env.AUTO_SEED !== 'false',
};
