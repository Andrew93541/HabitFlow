import { fileURLToPath } from 'node:url';
import { getLocalDateString, shiftDateString } from '../utils/dateUtils.js';
import { createDatabaseConnection } from './database.js';

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

export function seedDatabaseIfNeeded(db, todayStr = getLocalDateString(), { forceReset = false } = {}) {
  const alreadySeeded = db
    .prepare("SELECT value FROM app_meta WHERE key = 'initial_seed_v1'")
    .get();

  const existingHabitCount = db.prepare('SELECT COUNT(*) AS count FROM habits').get().count;

  if (!forceReset && (alreadySeeded || existingHabitCount > 0)) {
    return { seeded: false, count: existingHabitCount };
  }

  const samples = getSampleHabitsData(todayStr);

  const runSeed = db.transaction(() => {
    if (forceReset) {
      db.prepare('DELETE FROM habits').run();
    }

    const insertHabit = db.prepare(
      'INSERT INTO habits (name, category, description) VALUES (?, ?, ?)'
    );
    const insertCompletion = db.prepare(
      'INSERT OR IGNORE INTO habit_completions (habit_id, completion_date) VALUES (?, ?)'
    );

    for (const sample of samples) {
      const info = insertHabit.run(sample.name, sample.category, sample.description);
      const habitId = Number(info.lastInsertRowid);
      for (const completionDate of sample.completionDates) {
        insertCompletion.run(habitId, completionDate);
      }
    }

    db.prepare(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('initial_seed_v1', ?)"
    ).run(new Date().toISOString());
  });

  runSeed();
  return { seeded: true, count: samples.length };
}

const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectExecution) {
  const forceReset = process.argv.includes('--reset');
  const db = createDatabaseConnection(undefined, { autoSeed: false });
  const result = seedDatabaseIfNeeded(db, getLocalDateString(), { forceReset });
  db.close();
  if (result.seeded) {
    console.log(`Seeded ${result.count} sample habits successfully${forceReset ? ' (after reset)' : ''}.`);
  } else {
    console.log(`Database already initialized (${result.count} habits present). Use --reset to reseed.`);
  }
}
