import HabitItem from './HabitItem';
import EmptyState from './EmptyState';

export default function HabitList({
  habits,
  totalHabitsCount,
  activeFilter,
  selectedCategory,
  onResetFilter,
  togglingIds,
  onToggle,
  onOpenCalendar,
  onEdit,
  onDelete,
  onOpenAddModal,
}) {
  if (totalHabitsCount === 0) {
    return <EmptyState onOpenAddModal={onOpenAddModal} />;
  }

  if (habits.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 px-6 py-12 text-center">
        <p className="text-base font-semibold text-slate-800">
          No matching habits found
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {selectedCategory !== 'All'
            ? `No habits match status "${activeFilter}" in category "${selectedCategory}".`
            : activeFilter === 'completed'
              ? 'Check off a habit from your list to see it here.'
              : 'Awesome work—you have completed every habit scheduled for today!'}
        </p>
        <button
          type="button"
          onClick={onResetFilter}
          className="mt-4 inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="habit-list">
      {habits.map((habit) => (
        <HabitItem
          key={habit.id}
          habit={habit}
          isToggling={togglingIds.has(habit.id)}
          onToggle={onToggle}
          onOpenCalendar={onOpenCalendar}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
