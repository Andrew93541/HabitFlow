# HabitFlow Product & Engineering Requirements (`v2.0.0`)

## 1. Core Functional Requirements
- **Multi-User Accounts & Tenant Isolation:** Every user registers or signs in to an isolated personal workspace (`users`, `sessions`, `habits.user_id`). No user can read, modify, toggle, export, or delete another user's habits.
- **Instant Demo Sandbox:** First-time visitors and evaluators can launch a pre-seeded `Demo Explorer` session in one click without registration friction.
- **Green-Text Habit Completion & Independent Streaks:**
  - Checking a habit immediately turns **that habit's title text green** (`text-emerald-600`), displays `Completed`, and increments **only** that habit's streak by `1`.
  - Unchecking on the same calendar day reverts its title color (`text-slate-800`) and recalculates its streak from stored completion history without dropping below `0`.
- **True Consecutive-Day Streak Engine:**
  - Derived dynamically from local `YYYY-MM-DD` rows in `habit_completions`.
  - Enforces `UNIQUE(habit_id, completion_date)` to prevent duplicate completions on the same day.
  - Missing a calendar day resets the active streak to `0` while preserving `longestStreak` for historical reporting.
- **Habit Management, Search, Sort & Organization:**
  - Create, edit, and delete habits (with confirmation modal and `ON DELETE CASCADE`).
  - Assign categories (`General`, `Health`, `Study`, `Fitness`, `Mindfulness`, `Productivity`), filter by status or category, search by text, and sort (`Routine Order`, `Highest Streak`, `Newest`, `Alphabetical`).
- **Analytics & Data Portability:**
  - Dashboard KPI cards (`Total Habits`, `Completed Today`, `Pending Today`, `Best Streak`).
  - Per-habit **Monthly Calendar Heatmap** modal.
  - One-click **CSV** and **JSON** export plus **JSON Backup Import** (with case-insensitive habit merge and date deduplication).
- **Account Self-Service:** Update display name, change password (revoking other sessions), and permanently delete personal account + data.
