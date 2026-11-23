import { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  X,
} from 'lucide-react';
import { fetchHabitHistory } from '../services/api';
import { getCategoryBadgeClass } from '../utils/categories';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMonthTitle(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function buildMonthCells(year, monthIndex) {
  const firstDayWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDayWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const mm = String(monthIndex + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    cells.push({
      day,
      dateStr: `${year}-${mm}-${dd}`,
    });
  }
  return { cells, daysInMonth };
}

export default function HabitCalendarModal({ habit, todayStr, onClose }) {
  const [todayYear, todayMonthNum] = todayStr.split('-').map(Number);
  const [viewYear, setViewYear] = useState(todayYear);
  const [viewMonth, setViewMonth] = useState(todayMonthNum - 1); // 0-indexed

  const [historyData, setHistoryData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let isCancelled = false;

    fetchHabitHistory(habit.id, todayStr)
      .then((data) => {
        if (!isCancelled) {
          setHistoryData(data);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err.message || 'Unable to load completion history.');
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [habit.id, todayStr]);

  const completedSet = useMemo(
    () => new Set(historyData?.completionDates || []),
    [historyData]
  );

  const { cells, daysInMonth } = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;
  const completedInViewedMonth = useMemo(() => {
    let count = 0;
    for (const date of completedSet) {
      if (date.startsWith(monthPrefix)) count += 1;
    }
    return count;
  }, [completedSet, monthPrefix]);

  const monthlyPercentage = Math.round((completedInViewedMonth / daysInMonth) * 100);
  const isViewingCurrentMonth =
    viewYear === todayYear && viewMonth === todayMonthNum - 1;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToCurrentMonth = () => {
    setViewYear(todayYear);
    setViewMonth(todayMonthNum - 1);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="calendar-modal-title" className="text-lg font-bold text-slate-900">
                {habit.name}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${getCategoryBadgeClass(
                  habit.category || 'General'
                )}`}
              >
                {habit.category || 'General'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly completion heatmap &amp; streak history
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calendar modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              <p className="text-sm font-medium">Loading habit history...</p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          ) : (
            <>
              {/* Streak & Completion Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Flame className="h-3.5 w-3.5 text-orange-500" />
                    Current Streak
                  </div>
                  <p
                    data-testid="calendar-current-streak"
                    className="mt-1 text-lg font-bold text-slate-900"
                  >
                    {historyData.streak} {historyData.streak === 1 ? 'day' : 'days'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                    Best Streak
                  </div>
                  <p
                    data-testid="calendar-longest-streak"
                    className="mt-1 text-lg font-bold text-slate-900"
                  >
                    {historyData.longestStreak}{' '}
                    {historyData.longestStreak === 1 ? 'day' : 'days'}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Total Done
                  </div>
                  <p
                    data-testid="calendar-total-completions"
                    className="mt-1 text-lg font-bold text-slate-900"
                  >
                    {historyData.totalCompletions}
                  </p>
                </div>
              </div>

              {/* Month Navigation Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                  <h4
                    data-testid="calendar-month-title"
                    className="text-sm font-bold text-slate-900"
                  >
                    {formatMonthTitle(viewYear, viewMonth)}
                  </h4>
                  <span className="text-xs font-medium text-slate-500">
                    ({completedInViewedMonth}/{daysInMonth} days &middot; {monthlyPercentage}%)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {!isViewingCurrentMonth ? (
                    <button
                      type="button"
                      onClick={handleJumpToCurrentMonth}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors mr-1"
                    >
                      Today
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    aria-label="Previous month"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    aria-label="Next month"
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Monthly Calendar Heatmap Grid */}
              <div>
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {WEEKDAY_LABELS.map((dayLabel) => (
                    <div
                      key={dayLabel}
                      className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-1"
                    >
                      {dayLabel}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5" data-testid="calendar-heatmap-grid">
                  {cells.map((cell, index) => {
                    if (!cell) {
                      return <div key={`empty-${index}`} className="h-9 rounded-lg" />;
                    }

                    const isCompleted = completedSet.has(cell.dateStr);
                    const isToday = cell.dateStr === todayStr;
                    const isFuture = cell.dateStr > todayStr;

                    let cellClasses = 'bg-slate-100/90 text-slate-600';
                    if (isCompleted) {
                      cellClasses = 'bg-emerald-500 text-white font-semibold shadow-sm';
                    } else if (isFuture) {
                      cellClasses = 'bg-slate-50 text-slate-300';
                    }

                    return (
                      <div
                        key={cell.dateStr}
                        data-testid={`calendar-day-${cell.dateStr}`}
                        title={`${cell.dateStr}: ${
                          isCompleted ? 'Completed' : isFuture ? 'Upcoming' : 'Not completed'
                        }`}
                        aria-label={`${cell.dateStr}, ${
                          isCompleted ? 'completed' : isFuture ? 'upcoming' : 'not completed'
                        }`}
                        className={`h-9 rounded-lg flex items-center justify-center text-xs transition-colors ${cellClasses} ${
                          isToday ? 'ring-2 ring-emerald-600 ring-offset-1' : ''
                        }`}
                      >
                        {cell.day}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-emerald-500 inline-block" />
                    Completed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-slate-200 inline-block" />
                    Not completed
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded bg-white ring-2 ring-emerald-600 inline-block" />
                    Today
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
