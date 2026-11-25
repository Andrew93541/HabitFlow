import { getDb } from '../db/database.js';
import { resolveTargetDate } from '../utils/dateUtils.js';
import {
  generateHabitsCsv,
  generateHabitsJsonExport,
  normalizeCategory,
} from '../utils/exportUtils.js';
import { computeDashboardStats, formatHabitWithMetrics } from '../utils/streakUtils.js';

/**
 * Queries all habits belonging strictly to `userId` and enriches each with streak metrics.
 */
export function queryAllFormattedHabits(
  db,
  userId,
  todayStr,
  { includeFullDates = false } = {}
) {
  const habits = db
    .prepare(
      'SELECT id, name, category, description, created_at FROM habits WHERE user_id = ? ORDER BY id ASC'
    )
    .all(userId);

  if (habits.length === 0) {
    return [];
  }

  const completions = db
    .prepare(
      `SELECT hc.habit_id, hc.completion_date
       FROM habit_completions hc
       JOIN habits h ON h.id = hc.habit_id
       WHERE h.user_id = ?
       ORDER BY hc.completion_date DESC`
    )
    .all(userId);

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
 * Queries a single habit owned by `userId` and formats it with live streak metrics.
 */
export function querySingleFormattedHabit(
  db,
  userId,
  habitId,
  todayStr,
  { includeFullDates = false } = {}
) {
  const habit = db
    .prepare(
      'SELECT id, name, category, description, created_at FROM habits WHERE id = ? AND user_id = ?'
    )
    .get(habitId, userId);

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
    let habits = queryAllFormattedHabits(db, req.user.id, todayStr);

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
 */
export function getHabitHistory(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.query.date);
    const { habitId } = req;
    const db = getDb();

    const habitWithDates = querySingleFormattedHabit(db, req.user.id, habitId, todayStr, {
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
    const habitsWithHistory = queryAllFormattedHabits(db, req.user.id, todayStr, {
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
 * POST /api/habits/import
 * Imports habits and completion dates from a JSON backup into the authenticated user's account.
 * Merges completion dates into existing habits when names match case-insensitively.
 */
export function importHabitsData(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.body?.date ?? req.query.date);
    const incomingHabits = req.validatedImportHabits;
    const userId = req.user.id;
    const db = getDb();

    const executeImport = db.transaction(() => {
      const existingRows = db
        .prepare('SELECT id, name FROM habits WHERE user_id = ?')
        .all(userId);

      const byLowerName = new Map(
        existingRows.map((row) => [row.name.trim().toLowerCase(), row.id])
      );

      const insertHabit = db.prepare(
        'INSERT INTO habits (user_id, name, category, description) VALUES (?, ?, ?, ?)'
      );
      const insertCompletion = db.prepare(
        'INSERT OR IGNORE INTO habit_completions (habit_id, completion_date) VALUES (?, ?)'
      );

      let importedHabits = 0;
      let mergedHabits = 0;
      let importedCompletions = 0;

      for (const item of incomingHabits) {
        const key = item.name.toLowerCase();
        let targetHabitId = byLowerName.get(key);

        if (targetHabitId) {
          mergedHabits += 1;
        } else {
          const info = insertHabit.run(
            userId,
            item.name,
            item.category,
            item.description
          );
          targetHabitId = Number(info.lastInsertRowid);
          byLowerName.set(key, targetHabitId);
          importedHabits += 1;
        }

        for (const dateStr of item.completionDates) {
          const resInfo = insertCompletion.run(targetHabitId, dateStr);
          importedCompletions += resInfo.changes;
        }
      }

      const habits = queryAllFormattedHabits(db, userId, todayStr);
      const stats = computeDashboardStats(habits);

      return {
        summary: { importedHabits, mergedHabits, importedCompletions },
        habits,
        stats,
      };
    });

    const result = executeImport();
    return res.status(200).json(result);
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
      .prepare(
        'INSERT INTO habits (user_id, name, category, description) VALUES (?, ?, ?, ?)'
      )
      .run(req.user.id, name, category, description);

    const createdHabit = querySingleFormattedHabit(
      db,
      req.user.id,
      Number(result.lastInsertRowid),
      todayStr
    );
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
      .prepare(
        'UPDATE habits SET name = ?, category = ?, description = ? WHERE id = ? AND user_id = ?'
      )
      .run(name, category, description, habitId, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Habit not found.' });
    }

    const updatedHabit = querySingleFormattedHabit(db, req.user.id, habitId, todayStr);
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

    const result = db
      .prepare('DELETE FROM habits WHERE id = ? AND user_id = ?')
      .run(habitId, req.user.id);
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
    const userId = req.user.id;
    const db = getDb();

    const executeToggle = db.transaction(() => {
      const existingHabit = db
        .prepare('SELECT id FROM habits WHERE id = ? AND user_id = ?')
        .get(habitId, userId);

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

      const updatedHabit = querySingleFormattedHabit(db, userId, habitId, todayStr);
      const stats = computeDashboardStats(queryAllFormattedHabits(db, userId, todayStr));
      return { habit: updatedHabit, stats };
    });

    const payload = executeToggle();
    return res.status(200).json(payload);
  } catch (err) {
    return next(err);
  }
}
