import { getLastNDates, shiftDateString } from './dateUtils.js';

/**
 * Calculates the active consecutive-day streak for a habit as of `todayStr`.
 *
 * Rules:
 * - Duplicate completion dates are deduplicated via Set.
 * - If `todayStr` is completed, count consecutive calendar days backward starting from `todayStr`.
 * - If `todayStr` is NOT completed yet, count consecutive calendar days backward starting from
 *   yesterday (`todayStr - 1`). If yesterday was also missed, the streak is 0.
 *
 * @param {string[]} completionDates - Array of YYYY-MM-DD completion dates for this habit
 * @param {string} todayStr - Current local calendar date (YYYY-MM-DD)
 * @returns {number} Non-negative consecutive-day streak count
 */
export function calculateStreak(completionDates, todayStr) {
  if (!Array.isArray(completionDates) || completionDates.length === 0) {
    return 0;
  }

  const completedSet = new Set(completionDates);
  const startCursor = completedSet.has(todayStr)
    ? todayStr
    : shiftDateString(todayStr, -1);

  let streak = 0;
  let cursor = startCursor;

  while (completedSet.has(cursor)) {
    streak += 1;
    cursor = shiftDateString(cursor, -1);
  }

  return streak;
}

/**
 * Builds the 7-day completion timeline ending on `todayStr` for visual habit history.
 */
export function buildRecentHistory(completionDates, todayStr, days = 7) {
  const completedSet = new Set(completionDates);
  return getLastNDates(todayStr, days).map((date) => ({
    date,
    completed: completedSet.has(date),
  }));
}

/**
 * Formats a raw habit database row + its completion dates into the REST API response shape.
 */
export function formatHabitWithMetrics(habitRow, completionDates, todayStr) {
  const completedSet = new Set(completionDates);
  const completedToday = completedSet.has(todayStr);
  const streak = calculateStreak(completionDates, todayStr);

  return {
    id: habitRow.id,
    name: habitRow.name,
    description: habitRow.description || '',
    createdAt: habitRow.created_at,
    completedToday,
    streak,
    totalCompletions: completedSet.size,
    recentHistory: buildRecentHistory(completionDates, todayStr, 7),
  };
}

/**
 * Computes dashboard summary metrics from an array of formatted habits.
 */
export function computeDashboardStats(formattedHabits) {
  const totalHabits = formattedHabits.length;
  const completedToday = formattedHabits.filter((h) => h.completedToday).length;
  const pendingToday = totalHabits - completedToday;
  const bestStreak = formattedHabits.reduce(
    (max, habit) => (habit.streak > max ? habit.streak : max),
    0
  );

  return {
    totalHabits,
    completedToday,
    pendingToday,
    bestStreak,
  };
}
