import { Check, Flame, Pencil, Trash2 } from 'lucide-react';

export default function HabitItem({
  habit,
  isToggling,
  onToggle,
  onEdit,
  onDelete,
}) {
  const { id, name, description, completedToday, streak, recentHistory = [] } = habit;

  return (
    <article
      data-testid={`habit-card-${id}`}
      className={`group rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
        completedToday
          ? 'bg-emerald-50/40 border-emerald-200 shadow-sm'
          : 'bg-white border-slate-200/80 shadow-sm hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Accessible Checkbox with Smooth Pop Animation */}
        <label
          htmlFor={`habit-checkbox-${id}`}
          className="relative flex items-center justify-center mt-0.5 cursor-pointer select-none"
        >
          <input
            id={`habit-checkbox-${id}`}
            type="checkbox"
            checked={completedToday}
            disabled={isToggling}
            onChange={() => onToggle(habit)}
            aria-label={`Mark "${name}" as ${completedToday ? 'incomplete' : 'complete'} for today`}
            className="peer sr-only"
          />
          <span
            className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 ${
              completedToday
                ? 'bg-emerald-600 border-emerald-600 text-white animate-check-pop'
                : 'bg-white border-slate-300 hover:border-emerald-500 text-transparent'
            } ${isToggling ? 'opacity-60 cursor-wait' : ''}`}
          >
            <Check className="h-4 w-4 stroke-[3]" />
          </span>
        </label>

        {/* Habit Details — Core Requirement: Completed habit shows GREEN TEXT */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor={`habit-checkbox-${id}`}
              data-testid={`habit-name-${id}`}
              className={`text-base sm:text-[17px] font-semibold leading-snug cursor-pointer transition-colors duration-200 break-words ${
                completedToday ? 'text-emerald-600' : 'text-slate-800'
              }`}
            >
              {name}
            </label>

            {/* Streak & Completion Status Badges */}
            <div className="flex items-center flex-wrap gap-2 shrink-0">
              <span
                data-testid={`habit-status-${id}`}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                  completedToday
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {completedToday ? 'Completed' : 'Pending'}
              </span>

              <span
                data-testid={`habit-streak-${id}`}
                title="Current consecutive-day streak"
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold transition-colors ${
                  streak > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200/80'
                    : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                }`}
              >
                <Flame
                  className={`h-3.5 w-3.5 ${
                    streak > 0 ? 'text-orange-500 fill-orange-400' : 'text-slate-400'
                  }`}
                />
                <span>
                  {streak} {streak === 1 ? 'day' : 'days'}
                </span>
              </span>
            </div>
          </div>

          {description ? (
            <p
              className={`mt-1 text-sm leading-relaxed break-words transition-colors ${
                completedToday ? 'text-emerald-700/80' : 'text-slate-500'
              }`}
            >
              {description}
            </p>
          ) : null}

          {/* Bottom Row: 7-Day Activity Dots & Edit/Delete Controls */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            {recentHistory.length > 0 ? (
              <div
                className="flex items-center gap-1.5"
                aria-label="Last 7 days completion history"
              >
                <span className="text-[11px] font-medium text-slate-400 mr-1">
                  Last 7d:
                </span>
                {recentHistory.map((entry) => (
                  <span
                    key={entry.date}
                    title={`${entry.date}: ${entry.completed ? 'Completed' : 'Not completed'}`}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      entry.completed ? 'bg-emerald-500' : 'bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(habit)}
                aria-label={`Edit "${name}"`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(habit)}
                aria-label={`Delete "${name}"`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
