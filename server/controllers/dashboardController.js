import { getDb } from '../db/database.js';
import { resolveTargetDate } from '../utils/dateUtils.js';
import { computeDashboardStats } from '../utils/streakUtils.js';
import { queryAllFormattedHabits } from './habitController.js';

/**
 * GET /api/dashboard/stats
 */
export function getDashboardStats(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.query.date);
    const db = getDb();
    const habits = queryAllFormattedHabits(db, todayStr);
    const stats = computeDashboardStats(habits);

    return res.status(200).json({
      ...stats,
      date: todayStr,
    });
  } catch (err) {
    return next(err);
  }
}
