import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { createDatabaseConnection } from './database.js';

/**
 * Performs a safe online SQLite backup using better-sqlite3's native backup API.
 * Safe to run even while the production server is actively writing in WAL mode.
 */
export async function backupDatabase({
  sourcePath = env.DB_PATH,
  backupDir = env.BACKUP_DIR,
} = {}) {
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destinationPath = resolve(backupDir, `habitflow-backup-${timestamp}.db`);

  const db = createDatabaseConnection(sourcePath, { autoSeed: false });
  try {
    await db.backup(destinationPath);
    return destinationPath;
  } finally {
    db.close();
  }
}

const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  backupDatabase()
    .then((outputPath) => {
      console.log(`Database backup created successfully at: ${outputPath}`);
    })
    .catch((err) => {
      console.error('Database backup failed:', err);
      process.exit(1);
    });
}
