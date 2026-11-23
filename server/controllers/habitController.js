import { getDb } from '../db/database.js';
import { resolveTargetDate } from '../utils/dateUtils.js';
import {
  generateHabitsCsv,
  generateHabitsJsonExport,
  normalizeCategory,
} from '../utils/exportUtils.js';
import { computeDashboardStats, formatHabitWithMetrics } from '../utils/streakUtils.js';

/**
 * Queries all habits and their completion history in two indexed queries (no N+1)
 * and enriches each habit with `completedToday`, `streak`, `longestStreak`, and `recentHistory`.
 */
export function queryAllFormattedHabits(db, todayStr, { includeFullDates = false } = {}) {
  const habits = db
    .prepare('SELECT id, name, category, description, created_at FROM habits ORDER BY id ASC')
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

  return habits.map((habit) => {
    const dates = completionsByHabit.get(habit.id) || [];
    const formatted = formatHabitWithMetrics(habit, dates, todayStr);
    if (includeFullDates) {
      return { ...formatted, completionDates: [...new Set(dates)].sort() };
    }
    return formatted;
  });
}

/**
 * Queries a single habit by ID and formats it with live streak metrics.
 */
export function querySingleFormattedHabit(db, habitId, todayStr, { includeFullDates = false } = {}) {
  const habit = db
    .prepare('SELECT id, name, category, description, created_at FROM habits WHERE id = ?')
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
  const formatted = formatHabitWithMetrics(habit, completionDates, todayStr);
  if (includeFullDates) {
    return { ...formatted, completionDates: [...new Set(completionDates)].sort() };
  }
  return formatted;
}

/**
 * GET /api/habits
 */
export function getHabits(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.query.date);
    const rawCategory = req.query.category;
    const db = getDb();
    let habits = queryAllFormattedHabits(db, todayStr);

    if (rawCategory && rawCategory.toLowerCase() !== 'all') {
      const normalized = normalizeCategory(rawCategory);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid category filter.' });
      }
      habits = habits.filter((h) => h.category === normalized);
    }

    return res.status(200).json(habits);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/habits/:id/history
 * Returns complete completion dates and streak breakdown for the Monthly Calendar Heatmap modal.
 */
export function getHabitHistory(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.query.date);
    const { habitId } = req;
    const db = getDb();

    const habitWithDates = querySingleFormattedHabit(db, habitId, todayStr, {
      includeFullDates: true,
    });

    if (!habitWithDates) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    return res.status(200).json({
      habitId: habitWithDates.id,
      name: habitWithDates.name,
      category: habitWithDates.category,
      description: habitWithDates.description,
      completedToday: habitWithDates.completedToday,
      streak: habitWithDates.streak,
      longestStreak: habitWithDates.longestStreak,
      totalCompletions: habitWithDates.totalCompletions,
      completionDates: habitWithDates.completionDates,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/habits/export?format=csv|json&date=YYYY-MM-DD
 * Exports all habits and completion history as a downloadable CSV or JSON file.
 */
export function exportHabitsData(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.query.date);
    const format = String(req.query.format || 'json').toLowerCase();

    if (format !== 'csv' && format !== 'json') {
      return res.status(400).json({
        error: 'Invalid export format. Supported formats: "csv" or "json".',
      });
    }

    const db = getDb();
    const habitsWithHistory = queryAllFormattedHabits(db, todayStr, {
      includeFullDates: true,
    });
    const stats = computeDashboardStats(habitsWithHistory);

    if (format === 'csv') {
      const csvString = generateHabitsCsv(habitsWithHistory);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="habitflow-export-${todayStr}.csv"`
      );
      return res.status(200).send(csvString);
    }

    const jsonPayload = generateHabitsJsonExport(habitsWithHistory, stats, todayStr);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="habitflow-export-${todayStr}.json"`
    );
    return res.status(200).send(JSON.stringify(jsonPayload, null, 2));
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
    const { name, category, description } = req.validatedHabit;
    const db = getDb();

    const result = db
      .prepare('INSERT INTO habits (name, category, description) VALUES (?, ?, ?)')
      .run(name, category, description);

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
    const { name, category, description } = req.validatedHabit;
    const { habitId } = req;
    const db = getDb();

    const result = db
      .prepare('UPDATE habits SET name = ?, category = ?, description = ? WHERE id = ?')
      .run(name, category, description, habitId);

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
