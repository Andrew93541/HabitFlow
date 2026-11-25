import { useEffect, useState } from 'react';
import { FileUp, Upload, X } from 'lucide-react';

export default function ImportBackupModal({
  isSubmitting,
  onClose,
  onImport,
}) {
  const [parsedPayload, setParsedPayload] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    setParseError('');
    setParsedPayload(null);

    if (!file) {
      setFileName('');
      return;
    }

    setFileName(file.name);
    if (file.size > 512 * 1024) {
      setParseError('Backup file must be smaller than 512 KB.');
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const habitsArray = Array.isArray(json) ? json : json?.habits;
      if (!Array.isArray(habitsArray) || habitsArray.length === 0) {
        setParseError('No valid "habits" list found in this JSON file.');
        return;
      }
      setParsedPayload(habitsArray);
    } catch {
      setParseError('Selected file is not valid JSON.');
    }
  };

  const handleConfirm = async (event) => {
    event.preventDefault();
    if (!parsedPayload) {
      setParseError('Please choose a valid HabitFlow JSON backup file first.');
      return;
    }
    await onImport(parsedPayload);
  };

  const totalDates = parsedPayload
    ? parsedPayload.reduce(
        (sum, h) => sum + (Array.isArray(h.completionDates) ? h.completionDates.length : 0),
        0
      )
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 id="import-modal-title" className="text-lg font-bold text-slate-900">
            Import JSON Backup
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close import modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Restore habits and completion history from a HabitFlow <code>.json</code> export. Existing habits with the same name will safely merge completion dates without duplicating rows.
          </p>

          {parseError ? (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs font-medium text-red-700"
            >
              {parseError}
            </div>
          ) : null}

          <label
            htmlFor="backup-file-input"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 px-4 py-8 cursor-pointer transition-colors text-center"
          >
            <FileUp className="h-7 w-7 text-emerald-600" />
            <span className="text-sm font-semibold text-slate-800">
              {fileName || 'Select HabitFlow .json file'}
            </span>
            <span className="text-xs text-slate-400">Max 200 habits &middot; JSON format</span>
            <input
              id="backup-file-input"
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="sr-only"
            />
          </label>

          {parsedPayload ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200/70 px-4 py-3 text-xs text-emerald-900">
              Ready to import <strong>{parsedPayload.length}</strong>{' '}
              {parsedPayload.length === 1 ? 'habit' : 'habits'} with{' '}
              <strong>{totalDates}</strong> logged completion{' '}
              {totalDates === 1 ? 'date' : 'dates'}.
            </div>
          ) : null}

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
              disabled={!parsedPayload || isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-sm transition-all"
            >
              <Upload className="h-4 w-4" />
              <span>{isSubmitting ? 'Importing...' : 'Import Backup'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
