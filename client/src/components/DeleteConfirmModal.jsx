import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DeleteConfirmModal({
  habit,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!habit) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [habit, isDeleting, onCancel]);

  if (!habit) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 id="delete-modal-title" className="text-lg font-bold text-slate-900">
              Delete Habit?
            </h3>
            <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">&ldquo;{habit.name}&rdquo;</span>?
              This will permanently remove the habit and its{' '}
              <span className="font-medium">{habit.streak}-day</span> streak history.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(habit.id)}
            disabled={isDeleting}
            data-testid="confirm-delete-btn"
            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            {isDeleting ? 'Deleting...' : 'Delete Habit'}
          </button>
        </div>
      </div>
    </div>
  );
}
