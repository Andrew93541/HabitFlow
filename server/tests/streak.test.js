import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getLastNDates,
  isValidDateString,
  resolveTargetDate,
  shiftDateString,
} from '../utils/dateUtils.js';
import {
  calculateStreak,
  computeDashboardStats,
  formatHabitWithMetrics,
} from '../utils/streakUtils.js';

describe('Date Utilities', () => {
  it('validates real calendar dates and rejects impossible dates', () => {
    assert.equal(isValidDateString('2026-11-23'), true);
    assert.equal(isValidDateString('2024-02-29'), true); // leap year
    assert.equal(isValidDateString('2026-02-29'), false); // non-leap year
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

describe('Streak Calculation Engine', () => {
  const TODAY = '2026-11-23';

  it('returns 0 when completion history is empty', () => {
    assert.equal(calculateStreak([], TODAY), 0);
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
    // Unchecking today removes TODAY and recalculates from history
    assert.equal(calculateStreak(throughYesterday, TODAY), 3);
  });

  it('breaks the streak (resets to 0) when yesterday was missed', () => {
    const missedYesterday = ['2026-11-19', '2026-11-20', '2026-11-21']; // missed 2026-11-22
    assert.equal(calculateStreak(missedYesterday, TODAY), 0);

    // Completing today after a gap starts a fresh streak of 1
    assert.equal(calculateStreak([...missedYesterday, TODAY], TODAY), 1);
  });

  it('never double-counts duplicate date entries on the same day', () => {
    const duplicateToday = ['2026-11-22', TODAY, TODAY, TODAY];
    assert.equal(calculateStreak(duplicateToday, TODAY), 2);
  });

  it('computes dashboard summary statistics accurately', () => {
    const habits = [
      formatHabitWithMetrics({ id: 1, name: 'A', description: '', created_at: '' }, [TODAY], TODAY),
      formatHabitWithMetrics(
        { id: 2, name: 'B', description: '', created_at: '' },
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
