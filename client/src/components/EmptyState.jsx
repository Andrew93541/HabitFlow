import { Plus, Sparkles } from 'lucide-react';

export default function EmptyState({ onOpenAddModal }) {
  return (
    <div
      data-testid="empty-habits-state"
      className="bg-white rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center shadow-sm"
    >
      <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
        <Sparkles className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">No habits yet</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
        Start small and stay consistent. Add your first daily habit to begin tracking your daily completions and building streaks.
      </p>
      <button
        type="button"
        onClick={onOpenAddModal}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-2.5 shadow-sm shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        <Plus className="h-4 w-4 stroke-[2.5]" />
        Create Your First Habit
      </button>
    </div>
  );
}
