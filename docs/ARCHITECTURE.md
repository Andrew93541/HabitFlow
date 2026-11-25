# HabitFlow System Architecture & Scaling Guide (`v2.0.0`)

## 1. Production Multi-Tenant Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                   React + Vite Frontend (client/)                    │
│  ErrorBoundary + OfflineBanner + App.jsx (Session Hydration)         │
│    ├── AuthPage.jsx (Sign In / Sign Up / 1-Click Demo Sandbox)       │
│    └── DashboardPage.jsx                                             │
│          ├── Sidebar + Mobile Slide-Over Drawer + AccountSettings    │
│          ├── Header + Backup Menu (Export CSV/JSON, Import JSON)     │
│          └── StatsCards + Search/Sort/Category Bar + HabitList       │
│                └── HabitItem (Green Completed Text) + CalendarModal  │
│         │                                                            │
│         ▼                                                            │
│   services/api.js (fetch + credentials: 'include' + CSRF Header)     │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ HTTPS / HTTP JSON & CSV (/api/*)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                Node.js + Express Backend (server/)                   │
│  app.js ──► requestLogger (X-Request-Id) + CSP/HSTS Headers          │
│         ──► createRateLimiter + csrfProtection (X-Requested-With)    │
│         ──► authRoutes.js (/register, /login, /demo, /me, /account)  │
│         ──► requireAuth (HttpOnly Cookie -> SHA-256 Session Lookup)  │
│         ──► habitRoutes.js & dashboardRoutes.js (Scoped by user_id)  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ Synchronous ACID Transactions (WAL)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│              SQLite Multi-Tenant Database (habitflow.db)             │
│  users (id PK, name, email UNIQUE, password_hash, is_demo)           │
│    ├──► sessions (id PK, user_id FK CASCADE, token_hash UNIQUE)      │
│    └──► habits (id PK, user_id FK CASCADE, name, category, desc)     │
│           └──► habit_completions (id PK, habit_id FK CASCADE,        │
│                                   completion_date, UNIQUE(h, date))  │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Database & Migration Design
- **Non-Destructive Multi-Version Upgrades:** `initializeSchema()` automatically upgrades legacy `v1.0` (no `category` or `user_id`) and `v1.1` (no `user_id`) SQLite files to `v2.0` inside an atomic transaction—creating the built-in `Demo Explorer` account, assigning pre-existing habits to it, and verifying `PRAGMA foreign_key_check`.
- **Concurrency & Durability:** Configured with `PRAGMA journal_mode = WAL`, `PRAGMA synchronous = NORMAL`, `PRAGMA busy_timeout = 5000`, and `PRAGMA foreign_keys = ON`.
- **Scaling Path:** Single-node WAL SQLite easily serves thousands of registered users on a persistent disk volume (`Render` / `Railway` / `Fly.io` / VPS). If horizontal multi-region write replicas are ever needed, the controller SQL queries use standard ANSI SQL and can be ported cleanly to PostgreSQL.

## 3. How Frontend, Backend & Database Communicate (Viva Summary)
1. **Session Establishment:** Signing in (or clicking **Try Instant Demo Account**) sends a request with `X-Requested-With: HabitFlow` to Express. Express verifies credentials with `crypto.scrypt`, stores a SHA-256 digest of a 256-bit token in `sessions`, and sets an `HttpOnly` cookie.
2. **Tenant-Isolated Data Fetch:** `DashboardPage` calls `GET /api/habits` and `GET /api/dashboard/stats` with `credentials: 'include'`. `requireAuth` resolves `req.user` from the cookie, and `habitController` queries only rows `WHERE user_id = req.user.id`.
3. **Optimistic + Transactional Toggle:** Checking a habit immediately turns its title green (`text-emerald-600`) and increments its streak by `+1` in React state while `POST /api/habits/:id/toggle` executes an atomic SQLite transaction (`INSERT OR IGNORE` or `DELETE` on `habit_completions`) and returns recalculated metrics.
