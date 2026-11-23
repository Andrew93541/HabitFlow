# HabitFlow Multi-Layer Test & Verification Plan

## Test Layers Covered

| Layer | Scope | Tooling / Location | Status |
| :--- | :--- | :--- | :--- |
| **Layer 1: Static Analysis & Build** | ES module syntax checks, React Hooks ESLint rules, production Vite bundle | `npm run lint`, `npm --prefix server run lint`, `npm run build` | PASS |
| **Layer 2: Unit Testing** | `dateUtils.js` (leap years, month/year rollovers, invalid calendar dates) and `streakUtils.js` (0-state, +1 increment, uncheck recalculation, missed-day reset, duplicate date protection) | `server/tests/streak.test.js` (`node --test`) | PASS |
| **Layer 3 & 4: DB & API Integration** | Real Express HTTP server + isolated SQLite database testing CRUD, atomic `/toggle`, streak independence across habits, DB reconnect persistence, `UNIQUE` constraint, and `ON DELETE CASCADE` | `server/tests/api.test.js` (`node --test`) | PASS |
| **Layer 5 & 8: UI & Accessibility** | Green habit text (`text-emerald-600`) on check, color & streak revert on uncheck, streak independence, Add Habit modal, Delete Confirmation modal, Empty State, ARIA labels | `client/src/tests/Dashboard.test.jsx` (`vitest` + Testing Library) | PASS |
| **Layer 6: Security Checks** | `npm audit` (0 vulnerabilities in server and client), SQL injection literal escaping test, malformed payload rejection (`400`), security headers check | `server/tests/api.test.js` + `npm audit` | PASS |
| **Layer 10: Live Smoke & E2E** | Dual live servers (`localhost:5001` & `localhost:5173`) verified in real Chrome browser across full user journeys + browser refresh persistence | Live Browser Verification | Verified in Phase H |

## Running All Automated Checks
```bash
npm run lint
npm test
npm run build
```
