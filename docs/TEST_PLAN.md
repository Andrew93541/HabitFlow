# HabitFlow 10-Layer Production Test & Verification Matrix (`v2.0.0`)

| Layer | Scope | Verification Command / Suite | Status |
| :--- | :--- | :--- | :--- |
| **Layer 1: Static Analysis & Build** | Node ES module syntax across all backend modules, React Hooks ESLint rules, production Vite bundle | `npm run lint && npm run build` | PASS |
| **Layer 2: Unit Testing** | `dateUtils.js`, `streakUtils.js` (`calculateStreak`, `calculateLongestStreak`), `authUtils.js` (`scrypt`, `timingSafeEqual`, SHA-256 tokens, null-prototype cookie parser), `exportUtils.js` (CSV escaping & formula-injection defense) | `server/tests/streak.test.js` (`14` unit tests) | PASS |
| **Layer 3: Component & Database** | Legacy `v1`→`v2` multi-tenant migration without data loss, `UNIQUE(habit_id, completion_date)`, `users -> habits -> habit_completions` cascade deletes, online `.backup()` snapshot | `server/tests/api.test.js` + `Dashboard.test.jsx` | PASS |
| **Layer 4: Integration Testing** | Full Express + SQLite HTTP contract across Auth, Profile, Password rotation, Habits CRUD, Toggle, Monthly History, CSV/JSON Export, and JSON Backup Import/Merge | `server/tests/api.test.js` (`7` integration suites) | PASS |
| **Layer 5: End-to-End User Flows** | Unauthenticated `AuthPage` → 1-Click Demo Login → Check/Uncheck green text & streak → Search & Category Filter → Monthly Heatmap → Mobile Drawer → CSV Export → Sign Out | `client/src/tests/Dashboard.test.jsx` (`5` UI journey tests) | PASS |
| **Layer 6: Security Testing** | `npm run audit:all` (`0` vulnerabilities), `401` auth gate, `403` CSRF header enforcement, `429` rate limiting + `Retry-After`, cross-user IDOR (`404` on Alice/Bob habit IDs), SQLi & CSVi payloads, CSP/nosniff/DENY headers | `server/tests/api.test.js` + `npm run audit:all` | PASS |
| **Layer 7: Performance & Resilience** | 20-request parallel read/toggle concurrency stress test (`busy_timeout = 5000` + WAL), React `ErrorBoundary`, live `OfflineBanner` | `server/tests/api.test.js` + `ErrorBoundary.jsx` | PASS |
| **Layer 8: Accessibility & Compatibility** | Semantic dialogs (`role="dialog"`, `aria-modal`), `Escape` key dismissal, labelled checkboxes/inputs, keyboard-accessible tabs/radios/menus, mobile slide-over drawer | `client/src/tests/Dashboard.test.jsx` | PASS |
| **Layer 9: Regression Testing** | Core assignment behavior (`text-emerald-600` green text, `+1` independent streak, `0`-floor same-day uncheck, missed-day reset) verified after v2.0 upgrade | Full test suite (`npm test`) | PASS |
| **Layer 10: Staging & Production Smoke** | Single-port `NODE_ENV=production` Express static SPA + `/api/health` + live `server/data/habitflow.db` migration + online backup verification | Live Production Smoke Check | PASS |
