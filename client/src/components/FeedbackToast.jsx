import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function FeedbackToast({ toast, onDismiss }) {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-sm animate-fade-in-up"
    >
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg ${
          isError
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {isError ? (
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        )}
        <p className="text-sm font-medium leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className={`p-1 rounded-lg transition-colors ${
            isError ? 'hover:bg-red-100 text-red-600' : 'hover:bg-slate-800 text-slate-400'
          }`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
