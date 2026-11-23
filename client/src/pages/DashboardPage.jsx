import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Tag } from 'lucide-react';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import FeedbackToast from '../components/FeedbackToast';
import HabitCalendarModal from '../components/HabitCalendarModal';
import HabitFormModal from '../components/HabitFormModal';
import HabitList from '../components/HabitList';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import StatsCards from '../components/StatsCards';
import {
  createHabit,
  deleteHabit,
  downloadHabitsExport,
  fetchDashboardStats,
  fetchHabits,
  getLocalTodayDateString,
  toggleHabit,
  updateHabit,
} from '../services/api';
import { HABIT_CATEGORIES } from '../utils/categories';

function deriveStatsFromHabits(habitsList) {
  const totalHabits = habitsList.length;
  const completedToday = habitsList.filter((h) => h.completedToday).length;
  const pendingToday = totalHabits - completedToday;
  const bestStreak = habitsList.reduce(
    (max, h) => (h.streak > max ? h.streak : max),
    0
  );
  return { totalHabits, completedToday, pendingToday, bestStreak };
}

export default function DashboardPage() {
  const [todayStr, setTodayStr] = useState(() => getLocalTodayDateString());
  const [habits, setHabits] = useState([]);
  const [stats, setStats] = useState({
    totalHabits: 0,
    completedToday: 0,
    pendingToday: 0,
    bestStreak: 0,
  });
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Modal & in-flight states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState(null);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const [calendarHabit, setCalendarHabit] = useState(null);

  const [deletingHabit, setDeletingHabit] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [togglingIds, setTogglingIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    const currentLocalDate = getLocalTodayDateString();
    setTodayStr(currentLocalDate);

    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError('');

    try {
      const [habitsData, statsData] = await Promise.all([
        fetchHabits(currentLocalDate),
        fetchDashboardStats(currentLocalDate),
      ]);
      setHabits(habitsData);
      setStats({
        totalHabits: statsData.totalHabits,
        completedToday: statsData.completedToday,
        pendingToday: statsData.pendingToday,
        bestStreak: statsData.bestStreak,
      });
    } catch (err) {
      setLoadError(
        err.message ||
          'Unable to connect to the HabitFlow server. Please verify the backend is running.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const initialDate = getLocalTodayDateString();
    const timerRef = toastTimerRef;

    Promise.all([fetchHabits(initialDate), fetchDashboardStats(initialDate)])
      .then(([habitsData, statsData]) => {
        if (isCancelled) return;
        setTodayStr(initialDate);
        setHabits(habitsData);
        setStats({
          totalHabits: statsData.totalHabits,
          completedToday: statsData.completedToday,
          pendingToday: statsData.pendingToday,
          bestStreak: statsData.bestStreak,
        });
      })
      .catch((err) => {
        if (isCancelled) return;
        setLoadError(
          err.message ||
            'Unable to connect to the HabitFlow server. Please verify the backend is running.'
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Optimistic toggle + authoritative SQLite sync
  const handleToggleHabit = async (targetHabit) => {
    if (togglingIds.has(targetHabit.id)) return;

    const currentLocalDate = getLocalTodayDateString();
    setTodayStr(currentLocalDate);

    const nextCompleted = !targetHabit.completedToday;
    const optimisticStreak = nextCompleted
      ? targetHabit.streak + 1
      : Math.max(0, targetHabit.streak - 1);

    const previousHabits = habits;
    const previousStats = stats;

    // 1. Immediate UI update for only the clicked habit
    const optimisticHabits = habits.map((habit) => {
      if (habit.id !== targetHabit.id) return habit;
      const updatedRecent = Array.isArray(habit.recentHistory)
        ? habit.recentHistory.map((item) =>
            item.date === currentLocalDate ? { ...item, completed: nextCompleted } : item
          )
        : [];
      return {
        ...habit,
        completedToday: nextCompleted,
        streak: optimisticStreak,
        recentHistory: updatedRecent,
      };
    });

    setHabits(optimisticHabits);
    setStats(deriveStatsFromHabits(optimisticHabits));
    setTogglingIds((prev) => new Set(prev).add(targetHabit.id));

    try {
      // 2. Persist to SQLite and reconcile with recalculated history streak
      const result = await toggleHabit(targetHabit.id, {
        date: currentLocalDate,
        completed: nextCompleted,
      });

      setHabits((current) =>
        current.map((h) => (h.id === targetHabit.id ? result.habit : h))
      );
      setStats(result.stats);
      showToast(
        nextCompleted
          ? `"${result.habit.name}" completed! Streak: ${result.habit.streak} ${result.habit.streak === 1 ? 'day' : 'days'}.`
          : `"${result.habit.name}" marked incomplete.`
      );
    } catch (err) {
      setHabits(previousHabits);
      setStats(previousStats);
      showToast(err.message || 'Failed to update habit completion.', 'error');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetHabit.id);
        return next;
      });
    }
  };

  const handleOpenAddModal = () => {
    setEditingHabit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (habit) => {
    setEditingHabit(habit);
    setIsFormModalOpen(true);
  };

  const handleSubmitHabitForm = async (formData) => {
    setIsSubmittingForm(true);
    const currentLocalDate = getLocalTodayDateString();

    try {
      if (editingHabit) {
        const updated = await updateHabit(editingHabit.id, formData, currentLocalDate);
        setHabits((prev) => {
          const next = prev.map((h) => (h.id === updated.id ? updated : h));
          setStats(deriveStatsFromHabits(next));
          return next;
        });
        showToast(`Updated "${updated.name}".`);
      } else {
        const created = await createHabit(formData, currentLocalDate);
        setHabits((prev) => {
          const next = [...prev, created];
          setStats(deriveStatsFromHabits(next));
          return next;
        });
        showToast(`Added "${created.name}".`);
      }
      setIsFormModalOpen(false);
      setEditingHabit(null);
    } catch (err) {
      showToast(err.message || 'Failed to save habit.', 'error');
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleConfirmDelete = async (habitId) => {
    setIsDeleting(true);
    try {
      const deletedName = deletingHabit?.name || 'Habit';
      await deleteHabit(habitId);
      setHabits((prev) => {
        const next = prev.filter((h) => h.id !== habitId);
        setStats(deriveStatsFromHabits(next));
        return next;
      });
      setDeletingHabit(null);
      showToast(`Deleted "${deletedName}".`);
    } catch (err) {
      showToast(err.message || 'Failed to delete habit.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportHabits = async (format) => {
    setIsExporting(true);
    try {
      const filename = await downloadHabitsExport(format, getLocalTodayDateString());
      showToast(`Downloaded ${filename}.`);
    } catch (err) {
      showToast(err.message || 'Failed to export habit history.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredHabits = useMemo(() => {
    return habits.filter((h) => {
      if (activeFilter === 'completed' && !h.completedToday) return false;
      if (activeFilter === 'pending' && h.completedToday) return false;
      if (selectedCategory !== 'All' && (h.category || 'General') !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [habits, activeFilter, selectedCategory]);

  const filterTabs = [
    { id: 'all', label: 'All', count: stats.totalHabits },
    { id: 'pending', label: 'Pending', count: stats.pendingToday },
    { id: 'completed', label: 'Completed', count: stats.completedToday },
  ];

  const categoryFilterOptions = ['All', ...HABIT_CATEGORIES];

  return (
    <div className="min-h-screen flex bg-[#F7F9F8]">
      <Sidebar
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        stats={stats}
        onOpenAddModal={handleOpenAddModal}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          todayStr={todayStr}
          onOpenAddModal={handleOpenAddModal}
          onRefresh={() => loadDashboardData({ silent: true })}
          onExport={handleExportHabits}
          isRefreshing={isRefreshing}
          isExporting={isExporting}
        />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Summary Cards */}
          <StatsCards stats={stats} />

          {/* Error Banner */}
          {loadError ? (
            <div
              role="alert"
              className="rounded-2xl bg-red-50 border border-red-200 p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 text-red-800">
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                <span className="text-sm font-medium">{loadError}</span>
              </div>
              <button
                type="button"
                onClick={() => loadDashboardData()}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          ) : null}

          {/* Habit List Section Header + Status & Category Filters */}
          <section aria-labelledby="habits-heading" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2
                  id="habits-heading"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  Today&apos;s Habits
                </h2>
                <p className="text-xs sm:text-sm text-slate-500">
                  Check a habit to mark it done, turn its title green, and advance its streak.
                </p>
              </div>

              <div
                role="tablist"
                aria-label="Filter habits by completion status"
                className="inline-flex items-center rounded-xl bg-white border border-slate-200/80 p-1 shadow-sm"
              >
                {filterTabs.map((tab) => {
                  const isActive = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Filter Pills */}
            {habits.length > 0 ? (
              <div
                role="group"
                aria-label="Filter habits by category"
                className="flex items-center flex-wrap gap-1.5"
              >
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 mr-1">
                  <Tag className="h-3.5 w-3.5" />
                  Category:
                </span>
                {categoryFilterOptions.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {isLoading ? (
              <div
                data-testid="loading-state"
                className="bg-white rounded-2xl border border-slate-200/80 py-16 flex flex-col items-center justify-center gap-3 text-slate-500"
              >
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                <p className="text-sm font-medium">Loading your habits...</p>
              </div>
            ) : (
              <HabitList
                habits={filteredHabits}
                totalHabitsCount={habits.length}
                activeFilter={activeFilter}
                selectedCategory={selectedCategory}
                onResetFilter={() => {
                  setActiveFilter('all');
                  setSelectedCategory('All');
                }}
                togglingIds={togglingIds}
                onToggle={handleToggleHabit}
                onOpenCalendar={(habit) => setCalendarHabit(habit)}
                onEdit={handleOpenEditModal}
                onDelete={(habit) => setDeletingHabit(habit)}
                onOpenAddModal={handleOpenAddModal}
              />
            )}
          </section>
        </main>
      </div>

      {/* Add / Edit Modal */}
      {isFormModalOpen ? (
        <HabitFormModal
          key={editingHabit ? `edit-${editingHabit.id}` : 'create-habit'}
          editingHabit={editingHabit}
          isSubmitting={isSubmittingForm}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingHabit(null);
          }}
          onSubmit={handleSubmitHabitForm}
        />
      ) : null}

      {/* Monthly Calendar Heatmap Modal */}
      {calendarHabit ? (
        <HabitCalendarModal
          key={`calendar-${calendarHabit.id}-${calendarHabit.streak}-${calendarHabit.completedToday}`}
          habit={calendarHabit}
          todayStr={todayStr}
          onClose={() => setCalendarHabit(null)}
        />
      ) : null}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        habit={deletingHabit}
        isDeleting={isDeleting}
        onCancel={() => setDeletingHabit(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Toast Notification */}
      <FeedbackToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
