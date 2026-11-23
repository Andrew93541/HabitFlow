import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

export default function HabitFormModal({
  editingHabit,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState(() => editingHabit?.name || '');
  const [description, setDescription] = useState(() => editingHabit?.description || '');
  const [validationError, setValidationError] = useState('');

  const isEditMode = Boolean(editingHabit);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (!trimmedName) {
      setValidationError('Please enter a habit name.');
      return;
    }
    if (trimmedName.length > 100) {
      setValidationError('Habit name must be 100 characters or fewer.');
      return;
    }
    if (trimmedDescription.length > 300) {
      setValidationError('Description must be 300 characters or fewer.');
      return;
    }

    setValidationError('');
    await onSubmit({
      name: trimmedName,
      description: trimmedDescription,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 id="habit-modal-title" className="text-lg font-bold text-slate-900">
            {isEditMode ? 'Edit Habit' : 'Create New Habit'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-4" noValidate>
          {validationError ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {validationError}
            </div>
          ) : null}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="habit-name-input"
                className="block text-sm font-semibold text-slate-700"
              >
                Habit Name <span className="text-red-500">*</span>
              </label>
              <span className="text-xs text-slate-400">{name.length}/100</span>
            </div>
            <input
              id="habit-name-input"
              type="text"
              maxLength={100}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Drink 2L of water"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="habit-description-input"
                className="block text-sm font-semibold text-slate-700"
              >
                Description <span className="text-xs font-normal text-slate-400">(optional)</span>
              </label>
              <span className="text-xs text-slate-400">{description.length}/300</span>
            </div>
            <textarea
              id="habit-description-input"
              rows={3}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why does this habit matter, or when will you do it?"
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white shadow-sm shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              {isSubmitting
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Habit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
