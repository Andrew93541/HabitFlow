export const ALLOWED_CATEGORIES = [
  'General',
  'Health',
  'Study',
  'Fitness',
  'Mindfulness',
  'Productivity',
];

/**
 * Normalizes a category string case-insensitively against ALLOWED_CATEGORIES.
 * Returns null if invalid.
 */
export function normalizeCategory(rawCategory) {
  if (rawCategory === undefined || rawCategory === null || rawCategory === '') {
    return 'General';
  }
  if (typeof rawCategory !== 'string') {
    return null;
  }
  const trimmed = rawCategory.trim();
  if (!trimmed) {
    return 'General';
  }
  const match = ALLOWED_CATEGORIES.find(
    (cat) => cat.toLowerCase() === trimmed.toLowerCase()
  );
  return match || null;
}

/**
 * Escapes a single CSV cell per RFC 4180 and neutralizes spreadsheet formula injection
 * when a text cell begins with =, +, -, @, tab, or carriage return.
 */
export function escapeCsvCell(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Generates an RFC 4180 CSV export string for habits and their completion dates.
 */
export function generateHabitsCsv(habitsWithHistory) {
  const headers = [
    'Habit ID',
    'Habit Name',
    'Category',
    'Description',
    'Completed Today',
    'Current Streak',
    'Longest Streak',
    'Total Completions',
    'Created At',
    'Completion Dates',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const habit of habitsWithHistory) {
    const sortedDates = [...(habit.completionDates || [])].sort();
    const row = [
      habit.id,
      habit.name,
      habit.category || 'General',
      habit.description || '',
      habit.completedToday ? 'Yes' : 'No',
      habit.streak,
      habit.longestStreak,
      habit.totalCompletions,
      habit.createdAt,
      sortedDates.join('; '),
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Generates a structured JSON export payload for habits and their completion history.
 */
export function generateHabitsJsonExport(habitsWithHistory, stats, referenceDate) {
  return {
    exportedAt: new Date().toISOString(),
    referenceDate,
    summary: stats,
    habits: habitsWithHistory.map((habit) => ({
      id: habit.id,
      name: habit.name,
      category: habit.category || 'General',
      description: habit.description || '',
      completedToday: habit.completedToday,
      streak: habit.streak,
      longestStreak: habit.longestStreak,
      totalCompletions: habit.totalCompletions,
      createdAt: habit.createdAt,
      completionDates: [...(habit.completionDates || [])].sort(),
    })),
  };
}
