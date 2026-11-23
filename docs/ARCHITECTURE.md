# HabitFlow System Architecture & Viva Guide

## 1. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                   React + Vite Frontend (client/)               │
│  DashboardPage.jsx ──► StatsCards / HabitList / HabitItem       │
│         │              HabitFormModal / DeleteConfirmModal      │
│         ▼                                                       │
│   services/api.js (Native fetch + Local YYYY-MM-DD Date)        │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP JSON (/api/*)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                Node.js + Express Backend (server/)              │
│  app.js ──► habitRoutes.js / dashboardRoutes.js                 │
│         ──► middleware/validate.js & errorHandler.js            │
│         ──► controllers/habitController.js                      │
│         ──► utils/streakUtils.js & dateUtils.js                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Synchronous ACID Queries (better-sqlite3)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                SQLite Relational Database (habitflow.db)        │
│  Table: habits (id PK, name, description, created_at)           │
│  Table: habit_completions (id PK, habit_id FK CASCADE,          │
│                            completion_date, UNIQUE(habit_id,    │
│                            completion_date))                    │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Database Design Decisions
1. **Normalized Two-Table Schema:** Storing a simple integer `streak` column on `habits` is fragile—if a user misses two days without opening the app, a stored counter becomes stale, and unchecking today cannot know whether yesterday had a streak of `0` or `5`. Storing daily rows in `habit_completions` solves both problems cleanly.
2. **Duplicate Prevention:** `UNIQUE (habit_id, completion_date)` combined with `INSERT OR IGNORE` prevents duplicate completions even under rapid concurrent requests.
3. **Referential Integrity:** SQLite disables foreign keys by default on new connections; `database.js` explicitly executes `PRAGMA foreign_keys = ON;` so `ON DELETE CASCADE` automatically cleans up `habit_completions` whenever a habit is deleted.
4. **Concurrency & Speed:** `PRAGMA journal_mode = WAL;` enables Write-Ahead Logging for fast concurrent reads and durable writes.

## 3. Consecutive-Day Streak Algorithm (`server/utils/streakUtils.js`)
Given a habit's `completionDates` set and local `todayStr` (`YYYY-MM-DD`):
1. Deduplicate `completionDates` into a `Set`.
2. Determine the starting cursor:
   - If `todayStr` is in the set (`completedToday === true`), start at `todayStr`.
   - Otherwise (`completedToday === false`), start at `yesterday = shiftDateString(todayStr, -1)`.
3. Walk backward one calendar day at a time (`cursor = shiftDateString(cursor, -1)`) using DST-safe UTC calendar math while `completedSet.has(cursor)` is true, incrementing `streak`.
4. Return `streak` (`>= 0`).

## 4. Security Controls
- **SQL Injection Prevention:** 100% parameterized prepared statements (`db.prepare('... WHERE id = ?')`).
- **Input Validation:** Strict server-side validation for habit IDs, trimmed names (`1–100` chars), descriptions (`0–300` chars), JSON body size (`32kb` limit), and real calendar date validation (`rejects 2026-02-29`).
- **HTTP Hardening:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and restricted CORS origins.
