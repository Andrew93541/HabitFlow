import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import { seedDatabaseIfNeeded } from './seed.js';

let dbInstance = null;

/**
 * Initializes the SQLite schema, runs non-destructive v2 category migration if needed,
 * and configures WAL + Foreign Key enforcement.
 */
export function initializeSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0 AND length(name) <= 100),
      category TEXT NOT NULL DEFAULT 'General' CHECK(length(trim(category)) > 0 AND length(category) <= 30),
      description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 300),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      completion_date TEXT NOT NULL CHECK(
        completion_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
      ),
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE (habit_id, completion_date)
    );

    CREATE INDEX IF NOT EXISTS idx_habit_completions_habit_date
      ON habit_completions(habit_id, completion_date DESC);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Safe idempotent migration for databases created before the category column existed
  const habitColumns = db.prepare('PRAGMA table_info(habits)').all();
  const hasCategoryColumn = habitColumns.some((col) => col.name === 'category');
  if (!hasCategoryColumn) {
    db.exec("ALTER TABLE habits ADD COLUMN category TEXT NOT NULL DEFAULT 'General'");
  }

  // Backfill categories once for default v1 sample habits if upgrading an existing DB
  const backfilled = db
    .prepare("SELECT value FROM app_meta WHERE key = 'category_backfill_v2'")
    .get();

  if (!backfilled) {
    const runBackfill = db.transaction(() => {
      db.prepare(
        "UPDATE habits SET category = 'Health' WHERE name = 'Morning Hydration (500ml Water)' AND category = 'General'"
      ).run();
      db.prepare(
        "UPDATE habits SET category = 'Study' WHERE name = 'Read 20 Pages of Technical Book' AND category = 'General'"
      ).run();
      db.prepare(
        "UPDATE habits SET category = 'Productivity' WHERE name = '45-Minute Coding & DSA Practice' AND category = 'General'"
      ).run();
      db.prepare(
        "UPDATE habits SET category = 'Fitness' WHERE name = 'Evening Outdoor Walk' AND category = 'General'"
      ).run();
      db.prepare(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('category_backfill_v2', ?)"
      ).run(new Date().toISOString());
    });
    runBackfill();
  }
}

/**
 * Creates a fresh SQLite connection.
 */
export function createDatabaseConnection(dbPath = env.DB_PATH, { autoSeed = env.AUTO_SEED } = {}) {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }

  const db = new Database(dbPath);
  initializeSchema(db);

  if (autoSeed) {
    seedDatabaseIfNeeded(db, getLocalDateString());
  }

  return db;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseConnection();
  }
  return dbInstance;
}

export function setDb(customDb) {
  dbInstance = customDb;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
