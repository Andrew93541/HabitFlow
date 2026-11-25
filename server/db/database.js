import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '../config/env.js';
import { getLocalDateString } from '../utils/dateUtils.js';
import { ensureDemoUserRecord, seedDatabaseIfNeeded } from './seed.js';

let dbInstance = null;

/**
 * Initializes the production v2 multi-tenant SQLite schema (users, sessions, habits, habit_completions)
 * and safely migrates legacy v1 / v1.1 single-user databases without losing habits or completion rows.
 */
export function initializeSchema(db) {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('temp_store = MEMORY');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0 AND length(name) <= 80),
      email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK(length(trim(email)) >= 3 AND length(email) <= 160),
      password_hash TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Check if `habits` already exists (either fresh DB or legacy v1/v1.1 DB)
  const existingHabitsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'habits'")
    .get();

  if (!existingHabitsTable) {
    db.exec(`
      CREATE TABLE habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0 AND length(name) <= 100),
        category TEXT NOT NULL DEFAULT 'General' CHECK(length(trim(category)) > 0 AND length(category) <= 30),
        description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 300),
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  } else {
    const habitColumns = db.prepare('PRAGMA table_info(habits)').all();
    const hasCategoryColumn = habitColumns.some((col) => col.name === 'category');
    const hasUserIdColumn = habitColumns.some((col) => col.name === 'user_id');

    if (!hasCategoryColumn) {
      db.exec("ALTER TABLE habits ADD COLUMN category TEXT NOT NULL DEFAULT 'General'");
    }

    // Backfill default sample categories if upgrading from v1.0
    const backfilled = db
      .prepare("SELECT value FROM app_meta WHERE key = 'category_backfill_v2'")
      .get();
    if (!backfilled) {
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
    }

    // Migrate legacy single-user `habits` table to multi-user `habits` with FK CASCADE to `users`
    if (!hasUserIdColumn) {
      const demoUser = ensureDemoUserRecord(db);
      db.pragma('foreign_keys = OFF');
      try {
        const migrateToMultiTenant = db.transaction(() => {
          db.exec(`
            CREATE TABLE habits_v2 (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL CHECK(length(trim(name)) > 0 AND length(name) <= 100),
              category TEXT NOT NULL DEFAULT 'General' CHECK(length(trim(category)) > 0 AND length(category) <= 30),
              description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 300),
              created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
          `);

          db.prepare(`
            INSERT INTO habits_v2 (id, user_id, name, category, description, created_at)
            SELECT id, ?, name, category, description, created_at FROM habits
          `).run(demoUser.id);

          db.exec('DROP TABLE habits;');
          db.exec('ALTER TABLE habits_v2 RENAME TO habits;');
        });

        migrateToMultiTenant();
      } finally {
        db.pragma('foreign_keys = ON');
      }

      const fkViolations = db.pragma('foreign_key_check');
      if (fkViolations.length > 0) {
        throw new Error(`Foreign key integrity check failed during migration: ${JSON.stringify(fkViolations)}`);
      }
    }
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id, id ASC);

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
  `);
}

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
