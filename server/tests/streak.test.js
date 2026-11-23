import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLastNDates,
  isValidDateString,
  resolveTargetDate,
  shiftDateString,
} from '../utils/dateUtils.js';
import {
  escapeCsvCell,
  generateHabitsCsv,
  normalizeCategory,
} from '../utils/exportUtils.js';
import {
  calculateLongestStreak,
  calculateStreak,
  computeDashboardStats,
  formatHabitWithMetrics,
} from '../utils/streakUtils.js';

describe('Date Utilities', () => {
  it('validates real calendar dates and rejects impossible dates', () => {
    assert.equal(isValidDateString('2026-11-23'), true);
    assert.equal(isValidDateString('2024-02-29'), true);
    assert.equal(isValidDateString('2026-02-29'), false);
    assert.equal(isValidDateString('2026-13-01'), false);
    assert.equal(isValidDateString('23-11-2026'), false);
    assert.equal(isValidDateString(''), false);
  });

  it('shifts calendar dates accurately across month and year boundaries', () => {
    assert.equal(shiftDateString('2026-03-01', -1), '2026-02-28');
    assert.equal(shiftDateString('2024-03-01', -1), '2024-02-29');
    assert.equal(shiftDateString('2026-01-01', -1), '2025-12-31');
    assert.equal(shiftDateString('2026-12-31', 1), '2027-01-01');
  });

  it('builds ascending N-day history windows and throws 400 on invalid target date', () => {
    const window3 = getLastNDates('2026-11-23', 3);
    assert.deepEqual(window3, ['2026-11-21', '2026-11-22', '2026-11-23']);

    assert.throws(() => resolveTargetDate('2026-02-31'), (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    });
  });
});

describe('Streak & Longest Streak Engine', () => {
  const TODAY = '2026-11-23';

  it('returns 0 when completion history is empty', () => {
    assert.equal(calculateStreak([], TODAY), 0);
    assert.equal(calculateLongestStreak([]), 0);
  });

  it('returns 1 when completed for the first time today and reverts to 0 if unchecked', () => {
    assert.equal(calculateStreak([TODAY], TODAY), 1);
    assert.equal(calculateStreak([], TODAY), 0);
  });

  it('displays streak earned through yesterday when today is not completed yet', () => {
    const historyThroughYesterday = ['2026-11-20', '2026-11-21', '2026-11-22'];
    assert.equal(calculateStreak(historyThroughYesterday, TODAY), 3);
  });

  it('increments streak by 1 when today is completed after completing yesterday, and recalculates on uncheck', () => {
    const throughYesterday = ['2026-11-20', '2026-11-21', '2026-11-22'];
    const withToday = [...throughYesterday, TODAY];

    assert.equal(calculateStreak(throughYesterday, TODAY), 3);
    assert.equal(calculateStreak(withToday, TODAY), 4);
    assert.equal(calculateStreak(throughYesterday, TODAY), 3);
  });

  it('breaks current streak when yesterday was missed, while preserving historical longestStreak', () => {
    // 4-day historical run in October, then missed yesterday -> currentStreak=0, longestStreak=4
    const history = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-11-20',
      '2026-11-21',
    ];
    assert.equal(calculateStreak(history, TODAY), 0);
    assert.equal(calculateLongestStreak(history), 4);
    assert.equal(calculateStreak([...history, TODAY], TODAY), 1);
  });

  it('never double-counts duplicate date entries on the same day', () => {
    const duplicateToday = ['2026-11-22', TODAY, TODAY, TODAY];
    assert.equal(calculateStreak(duplicateToday, TODAY), 2);
    assert.equal(calculateLongestStreak(duplicateToday), 2);
  });

  it('computes dashboard summary statistics accurately', () => {
    const habits = [
      formatHabitWithMetrics(
        { id: 1, name: 'A', category: 'Health', description: '', created_at: '' },
        [TODAY],
        TODAY
      ),
      formatHabitWithMetrics(
        { id: 2, name: 'B', category: 'Study', description: '', created_at: '' },
        ['2026-11-20', '2026-11-21', '2026-11-22'],
        TODAY
      ),
    ];

    const stats = computeDashboardStats(habits);
    assert.deepEqual(stats, {
      totalHabits: 2,
      completedToday: 1,
      pendingToday: 1,
      bestStreak: 3,
    });
  });
});

describe('Category Normalization & CSV Export Security', () => {
  it('normalizes allowed categories case-insensitively and rejects unknown values', () => {
    assert.equal(normalizeCategory(undefined), 'General');
    assert.equal(normalizeCategory('health'), 'Health');
    assert.equal(normalizeCategory('  STUDY '), 'Study');
    assert.equal(normalizeCategory('UnknownTag'), null);
  });

  it('escapes CSV special characters and neutralizes spreadsheet formula injection', () => {
    assert.equal(escapeCsvCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
    assert.equal(escapeCsvCell('+cmd|calc'), "'+cmd|calc");
    assert.equal(escapeCsvCell('Read "Clean Code", Ch. 1'), '"Read ""Clean Code"", Ch. 1"');

    const csv = generateHabitsCsv([
      {
        id: 1,
        name: '=MaliciousHabit',
        category: 'Study',
        description: 'Line 1, Part 2',
        completedToday: true,
        streak: 2,
        longestStreak: 5,
        totalCompletions: 5,
        createdAt: '2026-11-01 08:00:00',
        completionDates: ['2026-11-23', '2026-11-22'],
      },
    ]);
    assert.ok(csv.includes("'=MaliciousHabit"));
    assert.ok(csv.includes('"Line 1, Part 2"'));
    assert.ok(csv.includes('2026-11-22; 2026-11-23'));
  });
});
