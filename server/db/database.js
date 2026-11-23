import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import { seedDatabaseIfNeeded } from './seed.js';

let dbInstance = null;

/**
 * Initializes the SQLite schema, constraints, indexes, and WAL/FK pragmas.
 */
export function initializeSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0 AND length(name) <= 100),
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
}

/**
 * Creates a fresh SQLite connection (used directly by isolated tests or singleton app startup).
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

/**
 * Returns the active SQLite database instance.
 */
export function getDb() {
  if (!dbInstance) {
    dbInstance = createDatabaseConnection();
  }
  return dbInstance;
}

/**
 * Overrides the active database instance (useful for integration testing) or closes it cleanly.
 */
export function setDb(customDb) {
  dbInstance = customDb;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
