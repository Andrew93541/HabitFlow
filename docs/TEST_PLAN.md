# HabitFlow Multi-Layer Test & Verification Plan

## Test Layers Covered

| Layer | Scope | Tooling / Location | Status |
| :--- | :--- | :--- | :--- |
| **Layer 1: Static Analysis & Build** | ES module syntax checks, React Hooks ESLint rules, production Vite bundle | `npm run lint`, `npm --prefix server run lint`, `npm run build` | PASS |
| **Layer 2: Unit Testing** | `dateUtils.js`, `streakUtils.js` (`calculateStreak` + `calculateLongestStreak`), and `exportUtils.js` (category normalization + RFC 4180 CSV escaping & formula-injection protection) | `server/tests/streak.test.js` (`node --test`, 12 tests) | PASS |
| **Layer 3 & 4: DB & API Integration** | Real Express HTTP server + isolated SQLite database testing non-destructive v1→v2 `ALTER TABLE` migration, CRUD + categories, `/history`, `/export` (`csv` & `json`), atomic `/toggle`, `UNIQUE` constraint, and `ON DELETE CASCADE` | `server/tests/api.test.js` (`node --test`, 5 tests) | PASS |
| **Layer 5 & 8: UI & Accessibility** | Green habit text (`text-emerald-600`) on check, revert on uncheck, category filter pills, Monthly Calendar Heatmap modal, CSV export download trigger, Add/Edit/Delete modals, Empty State | `client/src/tests/Dashboard.test.jsx` (`vitest` + Testing Library, 4 tests) | PASS |
| **Layer 6: Security Checks** | `npm audit` (0 vulnerabilities in server and client), SQL injection literal escaping test, malformed payload rejection (`400`), security headers check | `server/tests/api.test.js` + `npm audit` | PASS |
| **Layer 10: Live Smoke & E2E** | Dual live servers (`localhost:5001` & `localhost:5173`) verified in real Chrome browser across full user journeys + browser refresh persistence | Live Browser Verification | Verified in Phase H |

## Running All Automated Checks
```bash
npm run lint
npm test
npm run build
```
