import {
  CheckCircle2,
  CircleDot,
  Flame,
  LayoutDashboard,
  Plus,
  Sparkles,
} from 'lucide-react';

export default function Sidebar({
  activeFilter,
  onSelectFilter,
  stats,
  onOpenAddModal,
}) {
  const completionRate =
    stats.totalHabits > 0
      ? Math.round((stats.completedToday / stats.totalHabits) * 100)
      : 0;

  const navItems = [
    {
      id: 'all',
      label: 'All Habits',
      count: stats.totalHabits,
      icon: LayoutDashboard,
    },
    {
      id: 'pending',
      label: 'Pending Today',
      count: stats.pendingToday,
      icon: CircleDot,
    },
    {
      id: 'completed',
      label: 'Completed Today',
      count: stats.completedToday,
      icon: CheckCircle2,
    },
  ];

  return (
    <aside
      aria-label="HabitFlow Navigation Sidebar"
      className="hidden lg:flex lg:w-72 lg:flex-col lg:shrink-0 bg-white border-r border-slate-200/80 min-h-screen px-5 py-6 justify-between"
    >
      <div className="space-y-7">
        {/* Brand Logo */}
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">HabitFlow</h1>
            <p className="text-xs text-slate-500 font-medium">Daily Habit Tracker</p>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onOpenAddModal}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm py-3 px-4 shadow-sm shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          New Habit
        </button>

        {/* Filter Views */}
        <nav className="space-y-1.5" aria-label="Habit status filters">
          <p className="px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Views
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectFilter(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  {item.label}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {item.count}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Daily Progress Card */}
        <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Today&apos;s Progress</span>
            <span className="text-xs font-bold text-emerald-700">{completionRate}%</span>
          </div>
          <div
            className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden"
            role="progressbar"
            aria-valuenow={completionRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Daily habit completion percentage"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${completionRate}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            {stats.totalHabits === 0
              ? 'Add a habit to start tracking today.'
              : `${stats.completedToday} of ${stats.totalHabits} habits completed today.`}
          </p>
        </div>
      </div>

      {/* Streak Info Footer */}
      <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs mb-1">
          <Flame className="h-4 w-4 text-emerald-600" />
          Consecutive Streak Engine
        </div>
        <p className="text-xs text-emerald-900/75 leading-relaxed">
          Check off habits each calendar day to build your streak. Missing a full day resets that habit&apos;s streak to zero.
        </p>
      </div>
    </aside>
  );
}
