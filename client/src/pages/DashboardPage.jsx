import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpDown, Loader2, Search, Tag, X } from 'lucide-react';
import AccountSettingsModal from '../components/AccountSettingsModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import FeedbackToast from '../components/FeedbackToast';
import HabitCalendarModal from '../components/HabitCalendarModal';
import HabitFormModal from '../components/HabitFormModal';
import HabitList from '../components/HabitList';
import Header from '../components/Header';
import ImportBackupModal from '../components/ImportBackupModal';
import Sidebar from '../components/Sidebar';
import StatsCards from '../components/StatsCards';
import {
  createHabit,
  deleteHabit,
  downloadHabitsExport,
  fetchDashboardStats,
  fetchHabits,
  getLocalTodayDateString,
  importHabitsBackup,
  logoutAccount,
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

export default function DashboardPage({ user, onUserUpdated, onSignedOut }) {
  const [todayStr, setTodayStr] = useState(() => getLocalTodayDateString());
  const [habits, setHabits] = useState([]);
  const [stats, setStats] = useState({
    totalHabits: 0,
    completedToday: 0,
    pendingToday: 0,
    bestStreak: 0,
  });

  // Filtering, search & sorting
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('routine'); // 'routine' | 'streak' | 'alpha' | 'newest'

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Drawer & Modals
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const handleSignOut = async () => {
    try {
      await logoutAccount();
    } catch {
      // Proceed with local sign-out even if session already expired
    }
    onSignedOut();
  };

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

  const handleImportBackup = async (habitsArray) => {
    setIsImporting(true);
    try {
      const result = await importHabitsBackup(habitsArray, getLocalTodayDateString());
      setHabits(result.habits);
      setStats(result.stats);
      setIsImportModalOpen(false);
      showToast(
        `Imported ${result.summary.importedHabits} new, merged ${result.summary.mergedHabits} (${result.summary.importedCompletions} completions).`
      );
    } catch (err) {
      showToast(err.message || 'Backup import failed.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredHabits = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const matches = habits.filter((h) => {
      if (activeFilter === 'completed' && !h.completedToday) return false;
      if (activeFilter === 'pending' && h.completedToday) return false;
      if (selectedCategory !== 'All' && (h.category || 'General') !== selectedCategory) {
        return false;
      }
      if (normalizedQuery) {
        const inName = h.name.toLowerCase().includes(normalizedQuery);
        const inDesc = (h.description || '').toLowerCase().includes(normalizedQuery);
        if (!inName && !inDesc) return false;
      }
      return true;
    });

    const sorted = [...matches];
    if (sortBy === 'streak') {
      sorted.sort((a, b) => b.streak - a.streak || a.id - b.id);
    } else if (sortBy === 'alpha') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'newest') {
      sorted.sort((a, b) => b.id - a.id);
    } else {
      sorted.sort((a, b) => a.id - b.id);
    }

    return sorted;
  }, [habits, activeFilter, selectedCategory, searchQuery, sortBy]);

  const filterTabs = [
    { id: 'all', label: 'All', count: stats.totalHabits },
    { id: 'pending', label: 'Pending', count: stats.pendingToday },
    { id: 'completed', label: 'Completed', count: stats.completedToday },
  ];

  const categoryFilterOptions = ['All', ...HABIT_CATEGORIES];

  return (
    <div className="min-h-screen flex bg-[#F7F9F8]">
      <Sidebar
        user={user}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        stats={stats}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
        onOpenAddModal={handleOpenAddModal}
        onOpenAccountSettings={() => setIsAccountModalOpen(true)}
        onSignOut={handleSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          todayStr={todayStr}
          onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
          onOpenAddModal={handleOpenAddModal}
          onOpenImportModal={() => setIsImportModalOpen(true)}
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

          {/* Habit List Section Header + Search, Sort & Filters */}
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

            {/* Search, Sort & Category Controls */}
            {habits.length > 0 ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search habits by name or description..."
                      aria-label="Search habits"
                      className="w-full rounded-xl bg-white border border-slate-200/90 pl-9 pr-8 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    {searchQuery ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl bg-white border border-slate-200/90 px-3 py-2 shadow-sm shrink-0">
                    <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    <label htmlFor="habit-sort-select" className="sr-only">
                      Sort habits
                    </label>
                    <select
                      id="habit-sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="routine">Sort: Routine Order</option>
                      <option value="streak">Sort: Highest Streak</option>
                      <option value="newest">Sort: Newest First</option>
                      <option value="alpha">Sort: A to Z</option>
                    </select>
                  </div>
                </div>

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
                  setSearchQuery('');
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

      {/* Import Backup Modal */}
      {isImportModalOpen ? (
        <ImportBackupModal
          isSubmitting={isImporting}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportBackup}
        />
      ) : null}

      {/* Account Settings Modal */}
      {isAccountModalOpen ? (
        <AccountSettingsModal
          user={user}
          onClose={() => setIsAccountModalOpen(false)}
          onUserUpdated={onUserUpdated}
          onAccountDeleted={() => {
            setIsAccountModalOpen(false);
            onSignedOut();
          }}
          onShowToast={showToast}
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
