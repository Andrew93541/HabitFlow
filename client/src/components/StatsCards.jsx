import { CheckCircle2, Clock, Flame, ListChecks } from 'lucide-react';

export default function StatsCards({ stats }) {
  const cards = [
    {
      id: 'total',
      label: 'Total Habits',
      value: stats.totalHabits,
      subtitle: 'Active daily routines',
      icon: ListChecks,
      iconBg: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'completed',
      label: 'Completed Today',
      value: stats.completedToday,
      subtitle: 'Done for today',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      id: 'pending',
      label: 'Pending Today',
      value: stats.pendingToday,
      subtitle: 'Remaining today',
      icon: Clock,
      iconBg: 'bg-amber-100 text-amber-700',
    },
    {
      id: 'best-streak',
      label: 'Best Streak',
      value: `${stats.bestStreak} ${stats.bestStreak === 1 ? 'day' : 'days'}`,
      subtitle: 'Highest active streak',
      icon: Flame,
      iconBg: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <section
      aria-label="Dashboard Summary Statistics"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            data-testid={`stat-card-${card.id}`}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </p>
                <p
                  data-testid={`stat-value-${card.id}`}
                  className="mt-2 text-2xl font-bold text-slate-900 tracking-tight"
                >
                  {card.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{card.subtitle}</p>
              </div>
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
