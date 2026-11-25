import { useEffect } from 'react';
import {
  CheckCircle2,
  CircleDot,
  Flame,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';

function SidebarContent({
  user,
  activeFilter,
  onSelectFilter,
  stats,
  onOpenAddModal,
  onOpenAccountSettings,
  onSignOut,
  onCloseDrawer,
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

  const initials = (user?.name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col justify-between h-full px-5 py-6">
      <div className="space-y-7">
        {/* Brand Logo */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                HabitFlow
              </h1>
              <p className="text-xs text-slate-500 font-medium">Daily Habit Tracker</p>
            </div>
          </div>

          {onCloseDrawer ? (
            <button
              type="button"
              onClick={onCloseDrawer}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => {
            onOpenAddModal();
            onCloseDrawer?.();
          }}
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
                onClick={() => {
                  onSelectFilter(item.id);
                  onCloseDrawer?.();
                }}
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

      {/* Bottom User Account & Streak Tip */}
      <div className="space-y-4 pt-6">
        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-3.5">
          <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs mb-1">
            <Flame className="h-3.5 w-3.5 text-emerald-600" />
            Streak Rule
          </div>
          <p className="text-[11px] text-emerald-900/75 leading-relaxed">
            Complete habits each calendar day to build streaks. Missing a day resets that habit&apos;s streak to zero.
          </p>
        </div>

        {/* Authenticated User Card */}
        {user ? (
          <div className="rounded-2xl border border-slate-200/80 p-3 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{user.name}</p>
                  {user.isDemo ? (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                      Demo
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  onOpenAccountSettings();
                  onCloseDrawer?.();
                }}
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
              <button
                type="button"
                onClick={onSignOut}
                data-testid="sidebar-signout-btn"
                className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function Sidebar({
  user,
  activeFilter,
  onSelectFilter,
  stats,
  isMobileDrawerOpen,
  onCloseMobileDrawer,
  onOpenAddModal,
  onOpenAccountSettings,
  onSignOut,
}) {
  useEffect(() => {
    if (!isMobileDrawerOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseMobileDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen, onCloseMobileDrawer]);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        aria-label="HabitFlow Navigation Sidebar"
        className="hidden lg:flex lg:w-72 lg:flex-col lg:shrink-0 bg-white border-r border-slate-200/80 min-h-screen sticky top-0 h-screen overflow-y-auto"
      >
        <SidebarContent
          user={user}
          activeFilter={activeFilter}
          onSelectFilter={onSelectFilter}
          stats={stats}
          onOpenAddModal={onOpenAddModal}
          onOpenAccountSettings={onOpenAccountSettings}
          onSignOut={onSignOut}
        />
      </aside>

      {/* Mobile Slide-Over Navigation Drawer */}
      {isMobileDrawerOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
        >
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={onCloseMobileDrawer}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-white h-full overflow-y-auto shadow-xl">
            <SidebarContent
              user={user}
              activeFilter={activeFilter}
              onSelectFilter={onSelectFilter}
              stats={stats}
              onOpenAddModal={onOpenAddModal}
              onOpenAccountSettings={onOpenAccountSettings}
              onSignOut={onSignOut}
              onCloseDrawer={onCloseMobileDrawer}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
