import { getLastNDates, shiftDateString } from './dateUtils.js';

/**
 * Calculates the active consecutive-day streak for a habit as of `todayStr`.
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
 * Calculates the all-time longest consecutive-day streak from stored completion dates.
 */
export function calculateLongestStreak(completionDates) {
  if (!Array.isArray(completionDates) || completionDates.length === 0) {
    return 0;
  }

  const sortedDates = [...new Set(completionDates)].sort();
  let longest = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDates.length; i += 1) {
    if (shiftDateString(sortedDates[i - 1], 1) === sortedDates[i]) {
      currentRun += 1;
      if (currentRun > longest) {
        longest = currentRun;
      }
    } else {
      currentRun = 1;
    }
  }

  return longest;
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
  const longestStreak = calculateLongestStreak(completionDates);

  return {
    id: habitRow.id,
    name: habitRow.name,
    category: habitRow.category || 'General',
    description: habitRow.description || '',
    createdAt: habitRow.created_at,
    completedToday,
    streak,
    longestStreak,
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
