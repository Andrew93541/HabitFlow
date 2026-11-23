import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileJson,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { formatDisplayDate } from '../services/api';

export default function Header({
  todayStr,
  onOpenAddModal,
  onRefresh,
  onExport,
  isRefreshing,
  isExporting,
}) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    if (!isExportMenuOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isExportMenuOpen]);

  const handleSelectExport = (format) => {
    setIsExportMenuOpen(false);
    onExport(format);
  };

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Mobile Brand Badge */}
          <div className="lg:hidden h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Daily Overview
            </h2>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500">
              <CalendarDays className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{formatDisplayDate(todayStr)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Export History Menu (CSV / JSON) */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => setIsExportMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isExportMenuOpen}
              aria-label="Export habit history"
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Download className="h-4 w-4 text-slate-500" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {isExportMenuOpen ? (
              <div
                role="menu"
                aria-label="Export format options"
                className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-30 animate-fade-in-up"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectExport('csv')}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Export as CSV (.csv)
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelectExport('json')}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                >
                  <FileJson className="h-4 w-4 text-emerald-600" />
                  Export as JSON (.json)
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sync with database"
            aria-label="Refresh habits"
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm px-4 py-2.5 shadow-sm shadow-emerald-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add Habit</span>
          </button>
        </div>
      </div>
    </header>
  );
}
