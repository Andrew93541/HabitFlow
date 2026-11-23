# HabitFlow – Daily Habit Tracker

A clean, modern, full-stack daily habit tracker built with **React (Vite + Tailwind CSS)**, **Node.js + Express**, and **SQLite (`better-sqlite3`)**.

> **Core Assignment Behavior:** Displays a list of daily habits with interactive checkboxes. Checking a habit immediately turns **that habit's title text green**, displays a **Completed** badge, and increments **only that habit's consecutive-day streak counter** by `1`. Unchecking on the same day reverts its text color and recalculates the streak from stored completion history without dropping below `0`.

---

## Features

1. **Interactive Habit Checklist** — Each habit card displays an animated checkbox, habit title, optional description, completion status badge (`Completed` / `Pending`), 7-day mini activity dots, and an independent streak counter.
2. **Immediate Green Text & Streak Feedback** — Checking a habit turns its title text emerald green (`text-emerald-600`) and increments only that habit's streak by `+1`. Unchecking on the same day reverts the title to neutral slate (`text-slate-800`) and recalculates the streak cleanly.
3. **True Consecutive-Day Streak Engine** — Calculated dynamically from SQLite completion dates:
   - Completing today after completing yesterday extends the streak (`N -> N + 1`).
   - If today is still pending, displays the active streak earned through yesterday.
   - Missing a calendar day resets the streak to `0`.
   - Duplicate completions on the same calendar day are prevented in both the API (`INSERT OR IGNORE`) and SQLite schema (`UNIQUE(habit_id, completion_date)`).
4. **Full Habit CRUD & Categories** — Add new habits (name, category tag such as *Health*, *Study*, *Fitness*, *Mindfulness*, *Productivity*, and optional description), filter by category, edit existing habits, and delete habits with a confirmation modal (`ON DELETE CASCADE` removes associated completion history).
5. **Monthly Calendar Heatmap Modal** — Open any habit's **Calendar** view to explore a month-by-month emerald heatmap of completed days, monthly completion rate, current streak, and all-time longest streak.
6. **One-Click CSV & JSON Export** — Export all habits and full completion history from the header **Export** menu as spreadsheet-ready `.csv` or structured `.json`.
7. **Dashboard Summary Cards** — Live metrics for **Total Habits**, **Completed Today**, **Pending Today**, and **Best Streak**.
8. **Local Calendar Date Consistency** — Uses local `YYYY-MM-DD` calendar dates end-to-end rather than UTC `.toISOString()`, preventing midnight timezone mismatches.
9. **Responsive Minimalist UI** — Soft off-white background (`#F7F9F8`), emerald accents, desktop sidebar with daily progress bar, mobile header, filter tabs (`All` / `Pending` / `Completed`), empty state, loading spinner, toast notifications, and error recovery banner.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, JavaScript (ES Modules), Tailwind CSS, Lucide React |
| **Backend** | Node.js, Express.js |
| **Database** | SQLite via `better-sqlite3` (WAL mode + Foreign Keys enabled) |
| **API** | RESTful JSON API via native browser `fetch` |
| **Testing** | Node Built-in Test Runner (`node --test`), Vitest, React Testing Library |

---

## Project Structure

```text
HabitFlow/
├── client/                         # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── DeleteConfirmModal.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── FeedbackToast.jsx
│   │   │   ├── HabitFormModal.jsx
│   │   │   ├── HabitItem.jsx
│   │   │   ├── HabitList.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   └── StatsCards.jsx
│   │   ├── pages/
│   │   │   └── DashboardPage.jsx
│   │   ├── services/
│   │   │   └── api.js              # REST API fetch service & local date helper
│   │   ├── tests/
│   │   │   ├── Dashboard.test.jsx
│   │   │   └── setupTests.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
├── server/                         # Node.js + Express backend
│   ├── config/
│   │   └── env.js
│   ├── controllers/
│   │   ├── dashboardController.js
│   │   └── habitController.js
│   ├── db/
│   │   ├── database.js             # SQLite connection, schema & pragmas
│   │   └── seed.js                 # Relative-date sample habit seeder
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── validate.js
│   ├── routes/
│   │   ├── dashboardRoutes.js
│   │   └── habitRoutes.js
│   ├── tests/
│   │   ├── api.test.js
│   │   └── streak.test.js
│   ├── utils/
│   │   ├── dateUtils.js
│   │   └── streakUtils.js
│   ├── .env.example
│   ├── app.js
│   ├── server.js
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md             # Viva guide, ER schema & streak logic
│   └── TEST_PLAN.md                # Test layers & verification checklist
├── scripts/
│   └── dev.mjs                     # Concurrent dev launcher for server + client
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Installation & Execution

### Prerequisites
- **Node.js** `v20+` and **npm**

### 1. Install Dependencies
From the project root folder:
```bash
npm run install:all
```
*(Or install individually with `cd server && npm install` and `cd client && npm install`.)*

### 2. Optional Environment Configuration
Default ports work out of the box (`5001` for Express API, `5173` for Vite React frontend). To customize, copy the example files:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### 3. Run Both Servers Together (Recommended)
From the project root:
```bash
npm run dev
```
- **Frontend UI:** http://localhost:5173
- **Backend API:** http://localhost:5001/api/habits

*(Alternatively, run `npm run dev` inside `server/` in one terminal and `npm run dev` inside `client/` in a second terminal.)*

### 4. Sample Habits & Database Reset
On first startup, SQLite automatically creates `server/data/habitflow.db` and seeds **4 sample habits** with relative completion dates so you can immediately demonstrate streaks (`3 -> 4`, already completed `5`, `1`, and a broken streak reset to `0`).

To reset the database back to fresh sample habits before a viva demo:
```bash
npm run seed:reset
```

### 5. Run Tests, Linter & Production Build
```bash
npm run lint
npm test
npm run build
```

---

## REST API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/habits?date=YYYY-MM-DD&category=...` | Returns habits (optionally filtered by category) with `completedToday`, `streak`, `longestStreak`, and 7-day `recentHistory`. |
| `GET` | `/api/habits/:id/history?date=YYYY-MM-DD` | Returns full `completionDates`, `streak`, `longestStreak`, and `totalCompletions` for the Monthly Calendar Heatmap modal. |
| `GET` | `/api/habits/export?format=csv\|json` | Downloads complete habit & completion history as `.csv` or `.json`. |
| `POST` | `/api/habits` | Creates a new habit (`{ name, category?, description? }`). |
| `PUT` | `/api/habits/:id` | Updates an existing habit's `name`, `category`, and `description`. |
| `DELETE` | `/api/habits/:id` | Deletes a habit and cascades deletion to its `habit_completions`. |
| `POST` | `/api/habits/:id/toggle` | Toggles (or sets via `{ date, completed }`) today's completion in an atomic transaction and returns `{ habit, stats }`. |
| `GET` | `/api/dashboard/stats?date=YYYY-MM-DD` | Returns `{ totalHabits, completedToday, pendingToday, bestStreak, date }`. |
| `GET` | `/api/health` | Health check returning server status and local date. |

---

## How Frontend, Backend & Database Communicate (Viva Explanation)

1. **Initial Page Load (`React -> Express -> SQLite`):**
   - When `DashboardPage.jsx` mounts, `useEffect` gets the browser's local calendar date (`YYYY-MM-DD`) and calls `fetch('/api/habits?date=...')` and `fetch('/api/dashboard/stats?date=...')` via `client/src/services/api.js`.
   - Vite forwards `/api/*` requests to Express on port `5001`.
   - Express routes the request to `habitController.js`, which queries the `habits` and `habit_completions` tables in SQLite (`better-sqlite3`), calculates each habit's consecutive-day streak in `streakUtils.js`, and returns JSON.
   - React stores the returned data in `useState` hooks and renders the summary cards and habit checklist.

2. **Checking / Unchecking a Habit (`Checkbox -> Optimistic UI -> SQLite Transaction`):**
   - Clicking a habit's checkbox triggers `handleToggleHabit()` in `DashboardPage.jsx`.
   - React immediately updates that specific habit in state (`completedToday = true`, turning its title text green via `text-emerald-600`, and incrementing `streak` by `+1`), then sends `POST /api/habits/:id/toggle` with `{ date, completed }`.
   - Express runs a synchronous SQLite transaction: it either runs `INSERT OR IGNORE INTO habit_completions (habit_id, completion_date)` (when checking) or `DELETE FROM habit_completions` (when unchecking).
   - SQLite's `UNIQUE(habit_id, completion_date)` constraint guarantees a habit can never be recorded twice for the same date.
   - Express recalculates the true streak from stored completion dates and returns `{ habit, stats }`, keeping the UI and database 100% synchronized even after refreshing the browser.
