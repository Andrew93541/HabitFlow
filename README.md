# HabitFlow – Production Multi-User Daily Habit Tracker (`v2.0.0`)

A production-ready, multi-user daily habit tracker built with **React (Vite + Tailwind CSS)**, **Node.js + Express**, and **SQLite (`better-sqlite3`)**.

> **Core Visual & Streak Behavior:** Displays each user's daily habits with animated checkboxes. Checking a habit immediately turns **that habit's title text green** (`text-emerald-600`), shows a **Completed** badge, and increments **only that habit's consecutive-day streak** by `1`. Unchecking on the same day reverts its text color and recalculates the streak from stored completion history without going below `0`.

---

## Production Features

1. **Multi-User Accounts & 1-Click Demo Sandbox:**
   - Private workspaces per user (`Sign Up` / `Sign In` / `Sign Out`), plus a **Try Instant Demo Account** button for zero-friction evaluation.
   - Self-service **Account Settings** for updating display name, changing password, or permanently deleting your account and data.
2. **Hardened Authentication & API Security:**
   - Memory-hard `crypto.scrypt` password hashing with per-user CSPRNG salts and constant-time verification.
   - Server-side sessions using SHA-256 hashed tokens in `HttpOnly; SameSite=Lax` cookies (`Secure` over HTTPS), `X-Requested-With` CSRF protection, per-IP rate limiting, and strict CSP/security headers.
3. **True Consecutive-Day Streak Engine & Monthly Heatmaps:**
   - Local `YYYY-MM-DD` calendar consistency, `UNIQUE(habit_id, completion_date)` duplicate protection, missed-day streak reset, `longestStreak` tracking, and an interactive **Monthly Calendar Heatmap** modal per habit.
4. **Categories, Search, Sort & Mobile Drawer:**
   - Category badges & filters (*Health*, *Study*, *Fitness*, *Mindfulness*, *Productivity*, *General*), instant text search, sort modes (*Routine Order*, *Highest Streak*, *Newest*, *A–Z*), and a responsive slide-over mobile navigation drawer.
5. **Full Data Portability & Resilience:**
   - One-click **CSV** and **JSON** export, **JSON Backup Import** (with smart case-insensitive habit merge), live offline connectivity banner, React `ErrorBoundary`, and an online WAL-safe SQLite backup script (`npm run db:backup`).
6. **Turnkey Deployment & CI/CD:**
   - Single-port Express static SPA serving, 3-stage non-root `Dockerfile`, `docker-compose.yml`, Render Blueprint (`render.yaml`), and GitHub Actions CI (`.github/workflows/ci.yml`).

---

## Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Development Mode (Hot-Reload Express `:5001` + Vite `:5173`)
```bash
npm run dev
```
- Open **http://localhost:5173** — click **Try Instant Demo Account** or register a personal account.

### 3. Local Single-Port Production Mode
```bash
npm run build
npm start
```
- Serves both the compiled React SPA and REST API from Express on **http://localhost:5001**.

### 4. Docker Production Deployment
```bash
docker compose up -d --build
```

### 5. Quality, Security, Tests & Database Backups
```bash
npm run lint        # Backend syntax + Frontend ESLint checks
npm run audit:all   # Backend + Frontend npm vulnerability audits
npm test            # Backend unit/integration + Frontend Vitest suites
npm run db:backup   # Online WAL-safe SQLite snapshot backup
npm run seed:reset  # Reset the Demo Explorer account's sample habits
```

---

## REST API Overview

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new user account and start session |
| `POST` | `/api/auth/login` | Public | Authenticate user and set `HttpOnly` session cookie |
| `POST` | `/api/auth/demo` | Public | Start an instant Demo Explorer session |
| `POST` | `/api/auth/logout` | Cookie | Revoke current session and clear cookie |
| `GET` | `/api/auth/me` | Cookie | Return authenticated user profile |
| `PUT` | `/api/auth/profile` | Cookie | Update user display name |
| `PUT` | `/api/auth/password` | Cookie | Rotate password and revoke other sessions |
| `DELETE` | `/api/auth/account` | Cookie | Delete personal account and cascade all data |
| `GET` | `/api/habits` | Cookie | List authenticated user's habits with streak metrics |
| `POST` | `/api/habits` | Cookie | Create habit (`{ name, category?, description? }`) |
| `PUT` | `/api/habits/:id` | Cookie | Update user's habit |
| `DELETE` | `/api/habits/:id` | Cookie | Delete user's habit (`ON DELETE CASCADE`) |
| `POST` | `/api/habits/:id/toggle` | Cookie | Atomically toggle today's completion & recalculate streaks |
| `GET` | `/api/habits/:id/history` | Cookie | Full completion dates & streaks for Monthly Heatmap |
| `GET` | `/api/habits/export` | Cookie | Download `.csv` or `.json` habit history |
| `POST` | `/api/habits/import` | Cookie | Import & merge JSON backup into user's workspace |
| `GET` | `/api/dashboard/stats` | Cookie | Summary metrics (`Total`, `Completed`, `Pending`, `Best Streak`) |
| `GET` | `/api/health` | Public | Readiness probe verifying live SQLite connectivity |

---

## Documentation Index
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — Product & functional requirements
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Multi-tenant system architecture & viva walkthrough
- [docs/SECURITY.md](docs/SECURITY.md) — Threat model, `scrypt`/session/CSRF/IDOR controls
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Node, Docker, Render/Railway deployment & backup runbook
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md) — 10-layer verification strategy & test matrix
- [CHANGELOG.md](CHANGELOG.md) — Version history (`v1.0.0` → `v2.0.0`)
