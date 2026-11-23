# Changelog

## [1.1.0] - 2026-11-23
### Added
- **Habit Categories / Tags:** Added optional categories (`General`, `Health`, `Study`, `Fitness`, `Mindfulness`, `Productivity`) with non-destructive SQLite `ALTER TABLE` migration, colored category badges, and dashboard category filter pills.
- **Monthly Calendar Heatmap Modal:** Added `GET /api/habits/:id/history` and interactive `HabitCalendarModal` displaying month-by-month emerald completion heatmaps, current streak, all-time longest streak, and monthly completion percentage.
- **CSV & JSON History Export:** Added `GET /api/habits/export?format=csv|json` (with RFC 4180 escaping and spreadsheet formula-injection sanitization) and a Header Export menu for one-click `.csv` and `.json` downloads.

## [1.0.0] - 2026-11-23
### Added
- Initial full-stack release of **HabitFlow – Daily Habit Tracker** (React + Vite + Tailwind CSS + Express + `better-sqlite3`).
- Core green-text habit completion toggle, independent consecutive-day streak engine, CRUD modals with delete confirmation, dashboard summary cards, and automated test suites.
