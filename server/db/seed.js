import { fileURLToPath } from 'node:url';
import { hashPassword } from '../utils/authUtils.js';
import { getLocalDateString, shiftDateString } from '../utils/dateUtils.js';
import { createDatabaseConnection } from './database.js';

export const DEMO_USER_EMAIL = 'demo@habitflow.local';
export const DEMO_USER_NAME = 'Demo Explorer';

/**
 * Generates sample habits with categories and completion dates relative to `todayStr`.
 */
export function getSampleHabitsData(todayStr) {
  return [
    {
      name: 'Morning Hydration (500ml Water)',
      category: 'Health',
      description: 'Drink a full glass of water right after waking up before checking screens.',
      completedOffsets: [-3, -2, -1], // 3-day streak through yesterday; checking today makes it 4
    },
    {
      name: 'Read 20 Pages of Technical Book',
      category: 'Study',
      description: 'Focused reading session to build deep software engineering fundamentals.',
      completedOffsets: [-4, -3, -2, -1, 0], // Already completed today (green text, 5-day streak)
    },
    {
      name: '45-Minute Coding & DSA Practice',
      category: 'Productivity',
      description: 'Solve algorithmic problems or build full-stack project features daily.',
      completedOffsets: [-1], // 1-day streak earned yesterday; pending today
    },
    {
      name: 'Evening Outdoor Walk',
      category: 'Fitness',
      description: '20-minute brisk walk without headphones to recharge mental clarity.',
      completedOffsets: [-4, -3], // Missed -2 and -1 -> demonstrates broken streak reset to 0
    },
  ].map((item) => ({
    name: item.name,
    category: item.category,
    description: item.description,
    completionDates: item.completedOffsets.map((offset) => shiftDateString(todayStr, offset)),
  }));
}

/**
 * Ensures the built-in Demo account exists in `users` and returns its user record.
 */
export function ensureDemoUserRecord(db) {
  const existing = db
    .prepare('SELECT id, name, email, is_demo, created_at FROM users WHERE email = ?')
    .get(DEMO_USER_EMAIL);

  if (existing) {
    return existing;
  }

  const demoHash = hashPassword('DemoExplorer#2026!');
  const result = db
    .prepare(
      'INSERT INTO users (name, email, password_hash, is_demo) VALUES (?, ?, ?, 1)'
    )
    .run(DEMO_USER_NAME, DEMO_USER_EMAIL, demoHash);

  return db
    .prepare('SELECT id, name, email, is_demo, created_at FROM users WHERE id = ?')
    .get(Number(result.lastInsertRowid));
}

/**
 * Seeds starter sample habits for a specific user ID inside a transaction.
 */
export function seedStarterHabitsForUser(db, userId, todayStr = getLocalDateString()) {
  const samples = getSampleHabitsData(todayStr);
  const insertHabit = db.prepare(
    'INSERT INTO habits (user_id, name, category, description) VALUES (?, ?, ?, ?)'
  );
  const insertCompletion = db.prepare(
    'INSERT OR IGNORE INTO habit_completions (habit_id, completion_date) VALUES (?, ?)'
  );

  const run = db.transaction(() => {
    for (const sample of samples) {
      const info = insertHabit.run(userId, sample.name, sample.category, sample.description);
      const habitId = Number(info.lastInsertRowid);
      for (const completionDate of sample.completionDates) {
        insertCompletion.run(habitId, completionDate);
      }
    }
  });

  run();
  return samples.length;
}

/**
 * Seeds the Demo Explorer account once on initial database setup, or resets its habits when `forceReset` is true.
 */
export function seedDatabaseIfNeeded(
  db,
  todayStr = getLocalDateString(),
  { forceReset = false } = {}
) {
  const demoUser = ensureDemoUserRecord(db);

  const alreadySeeded = db
    .prepare("SELECT value FROM app_meta WHERE key = 'initial_seed_v1'")
    .get();

  const existingDemoCount = db
    .prepare('SELECT COUNT(*) AS count FROM habits WHERE user_id = ?')
    .get(demoUser.id).count;

  if (!forceReset && (alreadySeeded || existingDemoCount > 0)) {
    return { seeded: false, count: existingDemoCount, demoUserId: demoUser.id };
  }

  const runResetAndSeed = db.transaction(() => {
    if (forceReset) {
      db.prepare('DELETE FROM habits WHERE user_id = ?').run(demoUser.id);
    }
    const insertedCount = seedStarterHabitsForUser(db, demoUser.id, todayStr);
    db.prepare(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initial_seed_v1', ?)"
    ).run(new Date().toISOString());
    return insertedCount;
  });

  const count = runResetAndSeed();
  return { seeded: true, count, demoUserId: demoUser.id };
}

const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  const forceReset = process.argv.includes('--reset');
  const db = createDatabaseConnection(undefined, { autoSeed: false });
  const result = seedDatabaseIfNeeded(db, getLocalDateString(), { forceReset });
  db.close();
  if (result.seeded) {
    console.log(
      `Seeded ${result.count} demo habits successfully${forceReset ? ' (after reset)' : ''}.`
    );
  } else {
    console.log(
      `Demo account already initialized (${result.count} habits). Use --reset to reseed.`
    );
  }
}
