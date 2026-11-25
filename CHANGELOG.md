# Changelog

## [2.0.0] - 2026-11-25
### Added
- **Multi-User Authentication & Tenant Isolation:** Added `users` and `sessions` SQLite tables, `crypto.scrypt` password hashing, SHA-256 hashed opaque session tokens in `HttpOnly; SameSite=Lax` cookies, Sign Up / Sign In UI, **1-Click Instant Demo Account**, and strict `user_id` isolation across every habit, stats, history, export, and import query.
- **Account Self-Service:** Added `AccountSettingsModal` supporting profile display-name updates, password rotation (revoking other sessions), and permanent account + data deletion (`ON DELETE CASCADE`).
- **Production Security & Rate Limiting:** Added `X-Requested-With: HabitFlow` CSRF protection, per-IP rate limiting (`429` + `Retry-After`), hardened CSP/HSTS/Permissions-Policy headers, `X-Request-Id` structured logging, and SQLite `WAL` + `busy_timeout = 5000` tuning.
- **UX & Data Portability Enhancements:** Added instant habit Search & Sort (`Routine Order`, `Highest Streak`, `Newest`, `A–Z`), **JSON Backup Import** (`POST /api/habits/import` with smart case-insensitive merge), responsive slide-over **Mobile Navigation Drawer**, React `ErrorBoundary`, and live `OfflineBanner`.
- **DevOps, Backup & CI/CD:** Added 3-stage non-root `Dockerfile`, `docker-compose.yml`, `render.yaml`, `.github/workflows/ci.yml`, online SQLite backup utility (`npm run db:backup`), and `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, and `docs/REQUIREMENTS.md`.

## [1.1.0] - 2026-11-23
### Added
- **Habit Categories / Tags:** Added optional categories (`General`, `Health`, `Study`, `Fitness`, `Mindfulness`, `Productivity`) with non-destructive SQLite migration and filter pills.
- **Monthly Calendar Heatmap Modal:** Added `GET /api/habits/:id/history` and month-by-month emerald completion heatmap modal.
- **CSV & JSON History Export:** Added `GET /api/habits/export?format=csv|json` with spreadsheet formula-injection sanitization.

## [1.0.0] - 2026-11-23
### Added
- Initial full-stack release of **HabitFlow – Daily Habit Tracker** (React + Vite + Tailwind CSS + Express + `better-sqlite3`).
