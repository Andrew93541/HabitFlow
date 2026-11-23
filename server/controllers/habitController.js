import { getDb } from '../db/database.js';
import { resolveTargetDate } from '../utils/dateUtils.js';
import { computeDashboardStats, formatHabitWithMetrics } from '../utils/streakUtils.js';

/**
 * Queries all habits and their completion history in two indexed queries (no N+1)
 * and enriches each habit with `completedToday`, `streak`, and `recentHistory`.
 */
export function queryAllFormattedHabits(db, todayStr) {
  const habits = db
    .prepare('SELECT id, name, description, created_at FROM habits ORDER BY id ASC')
    .all();

  if (habits.length === 0) {
    return [];
  }

  const completions = db
    .prepare(
      'SELECT habit_id, completion_date FROM habit_completions ORDER BY completion_date DESC'
    )
    .all();

  const completionsByHabit = new Map();
  for (const row of completions) {
    if (!completionsByHabit.has(row.habit_id)) {
      completionsByHabit.set(row.habit_id, []);
    }
    completionsByHabit.get(row.habit_id).push(row.completion_date);
  }

  return habits.map((habit) =>
    formatHabitWithMetrics(habit, completionsByHabit.get(habit.id) || [], todayStr)
  );
}

/**
 * Queries a single habit by ID and formats it with live streak metrics.
 */
export function querySingleFormattedHabit(db, habitId, todayStr) {
  const habit = db
    .prepare('SELECT id, name, description, created_at FROM habits WHERE id = ?')
    .get(habitId);

  if (!habit) {
    return null;
  }

  const completionRows = db
    .prepare(
      'SELECT completion_date FROM habit_completions WHERE habit_id = ? ORDER BY completion_date DESC'
    )
    .all(habitId);

  const completionDates = completionRows.map((r) => r.completion_date);
  return formatHabitWithMetrics(habit, completionDates, todayStr);
}

/**
 * GET /api/habits
 */
export function getHabits(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.query.date);
    const db = getDb();
    const habits = queryAllFormattedHabits(db, todayStr);
    return res.status(200).json(habits);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/habits
 */
export function createHabit(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.body?.date ?? req.query.date);
    const { name, description } = req.validatedHabit;
    const db = getDb();

    const result = db
      .prepare('INSERT INTO habits (name, description) VALUES (?, ?)')
      .run(name, description);

    const createdHabit = querySingleFormattedHabit(db, Number(result.lastInsertRowid), todayStr);
    return res.status(201).json(createdHabit);
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/habits/:id
 */
export function updateHabit(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.body?.date ?? req.query.date);
    const { name, description } = req.validatedHabit;
    const { habitId } = req;
    const db = getDb();

    const result = db
      .prepare('UPDATE habits SET name = ?, description = ? WHERE id = ?')
      .run(name, description, habitId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    const updatedHabit = querySingleFormattedHabit(db, habitId, todayStr);
    return res.status(200).json(updatedHabit);
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/habits/:id
 */
export function deleteHabit(req, res, next) {
  try {
    const { habitId } = req;
    const db = getDb();

    const result = db.prepare('DELETE FROM habits WHERE id = ?').run(habitId);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    return res.status(200).json({
      message: 'Habit deleted successfully.',
      id: habitId,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/habits/:id/toggle
 * Atomically toggles (or explicitly sets via optional `completed` boolean)
 * today's completion record for the specified habit and recalculates streaks.
 */
export function toggleHabitCompletion(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.body?.date ?? req.query.date);
    const desiredState =
      typeof req.body?.completed === 'boolean' ? req.body.completed : undefined;
    const { habitId } = req;
    const db = getDb();

    const executeToggle = db.transaction(() => {
      const existingHabit = db
        .prepare('SELECT id FROM habits WHERE id = ?')
        .get(habitId);

      if (!existingHabit) {
        const notFoundErr = new Error('Habit not found.');
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const existingCompletion = db
        .prepare(
          'SELECT id FROM habit_completions WHERE habit_id = ? AND completion_date = ?'
        )
        .get(habitId, todayStr);

      const shouldComplete =
        desiredState !== undefined ? desiredState : !existingCompletion;

      if (shouldComplete) {
        // INSERT OR IGNORE + UNIQUE(habit_id, completion_date) guarantees no duplicate day entries
        db.prepare(
          'INSERT OR IGNORE INTO habit_completions (habit_id, completion_date) VALUES (?, ?)'
        ).run(habitId, todayStr);
      } else {
        db.prepare(
          'DELETE FROM habit_completions WHERE habit_id = ? AND completion_date = ?'
        ).run(habitId, todayStr);
      }

      const updatedHabit = querySingleFormattedHabit(db, habitId, todayStr);
      const stats = computeDashboardStats(queryAllFormattedHabits(db, todayStr));
      return { habit: updatedHabit, stats };
    });

    const payload = executeToggle();
    return res.status(200).json(payload);
  } catch (err) {
    return next(err);
  }
}
