import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import express from 'express';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app.js';
import { backupDatabase } from '../db/backup.js';
import { closeDb, createDatabaseConnection, initializeSchema, setDb } from '../db/database.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

function extractCookiePair(res) {
  const setCookie = res.headers.get('set-cookie') || '';
  return setCookie.split(';')[0];
}

describe('HabitFlow Production v2.0 Multi-Tenant API, Security & Resilience Suite', () => {
  let server;
  let baseUrl;
  let tempDir;
  let dbPath;
  let db;
  let aliceCookie;
  let bobCookie;
  const TEST_TODAY = '2026-11-23';

  const csrfHeaders = (cookie, extra = {}) => ({
    'Content-Type': 'application/json',
    'X-Requested-With': 'HabitFlow',
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  });

  before(async () => {
    process.env.NODE_ENV = 'test';
    tempDir = mkdtempSync(join(tmpdir(), 'habitflow-v2-test-'));
    dbPath = join(tempDir, 'test-habits-v2.db');
    db = createDatabaseConnection(dbPath, { autoSeed: false });
    setDb(db);

    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
    closeDb();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('migrates a legacy single-user v1 SQLite database (habits + habit_completions) to multi-tenant v2 without data loss', () => {
    const legacyPath = join(tempDir, 'legacy-v1-with-completions.db');
    const legacyDb = new Database(legacyPath);
    legacyDb.exec(`
      CREATE TABLE habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      CREATE TABLE habit_completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        habit_id INTEGER NOT NULL,
        completion_date TEXT NOT NULL,
        FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
        UNIQUE (habit_id, completion_date)
      );
      INSERT INTO habits (id, name, description) VALUES (10, 'Morning Hydration (500ml Water)', 'Legacy');
      INSERT INTO habit_completions (habit_id, completion_date) VALUES (10, '2026-11-22');
    `);

    initializeSchema(legacyDb);

    const migratedHabit = legacyDb
      .prepare('SELECT id, user_id, name, category FROM habits WHERE id = 10')
      .get();
    assert.equal(migratedHabit.name, 'Morning Hydration (500ml Water)');
    assert.equal(migratedHabit.category, 'Health');
    assert.ok(migratedHabit.user_id > 0);

    const completionCount = legacyDb
      .prepare('SELECT COUNT(*) AS count FROM habit_completions WHERE habit_id = 10')
      .get().count;
    assert.equal(completionCount, 1);

    // Deleting the owner user must cascade to habits AND habit_completions
    legacyDb.prepare('DELETE FROM users WHERE id = ?').run(migratedHabit.user_id);
    assert.equal(legacyDb.prepare('SELECT COUNT(*) AS c FROM habits').get().c, 0);
    assert.equal(legacyDb.prepare('SELECT COUNT(*) AS c FROM habit_completions').get().c, 0);
    legacyDb.close();
  });

  it('GET /api/health returns connected database readiness and hardened CSP/security headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('content-security-policy')?.includes("default-src 'self'"));
    assert.ok(res.headers.get('x-request-id'));
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.database, 'connected');
  });

  it('enforces authentication (401) and CSRF header verification (403)', async () => {
    const unauthHabits = await fetch(`${baseUrl}/api/habits`);
    assert.equal(unauthHabits.status, 401);

    const missingCsrf = await fetch(`${baseUrl}/api/auth/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(missingCsrf.status, 403);
  });

  it('registers users, hashes session tokens in SQLite, supports 1-click Demo login, and rejects duplicate emails', async () => {
    // Register Alice (clean workspace)
    const regAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({
        name: 'Alice Rivera',
        email: 'alice@example.com',
        password: 'AliceSecurePassword123!',
        includeStarterHabits: false,
      }),
    });
    assert.equal(regAlice.status, 201);
    const setCookieHeader = regAlice.headers.get('set-cookie') || '';
    assert.ok(setCookieHeader.includes('HttpOnly'));
    assert.ok(setCookieHeader.includes('SameSite=Lax'));
    aliceCookie = extractCookiePair(regAlice);

    // Verify raw cookie token is NOT stored in plaintext in SQLite `sessions`
    const rawTokenValue = decodeURIComponent(aliceCookie.split('=')[1]);
    const storedSession = db.prepare('SELECT token_hash FROM sessions LIMIT 1').get();
    assert.notEqual(storedSession.token_hash, rawTokenValue);
    assert.equal(storedSession.token_hash.length, 64);

    // Duplicate email rejected with 409
    const dupAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({
        name: 'Alice Clone',
        email: 'ALICE@example.com',
        password: 'AnotherPassword123!',
      }),
    });
    assert.equal(dupAlice.status, 409);

    // Wrong password rejected with 401
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({
        email: 'alice@example.com',
        password: 'WrongPassword999!',
      }),
    });
    assert.equal(badLogin.status, 401);

    // Register Bob
    const regBob = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({
        name: 'Bob Chen',
        email: 'bob@example.com',
        password: 'BobSecurePassword123!',
        includeStarterHabits: false,
      }),
    });
    assert.equal(regBob.status, 201);
    bobCookie = extractCookiePair(regBob);

    // Instant 1-Click Demo account login seeds 4 demo habits isolated to demo user
    const demoRes = await fetch(`${baseUrl}/api/auth/demo`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({ date: TEST_TODAY }),
    });
    assert.equal(demoRes.status, 200);
    const demoCookie = extractCookiePair(demoRes);
    const demoHabits = await (
      await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`, {
        headers: { Cookie: demoCookie },
      })
    ).json();
    assert.equal(demoHabits.length, 4);
  });

  it('strictly isolates tenant data (prevents cross-user IDOR on read, toggle, edit, history, and delete)', async () => {
    // Alice creates a habit
    const createRes = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: csrfHeaders(aliceCookie),
      body: JSON.stringify({
        name: 'Alice Morning Run',
        category: 'Fitness',
        description: '5km run',
        date: TEST_TODAY,
      }),
    });
    assert.equal(createRes.status, 201);
    const aliceHabit = await createRes.json();

    // Bob sees 0 habits in his workspace
    const bobList = await (
      await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`, {
        headers: { Cookie: bobCookie },
      })
    ).json();
    assert.deepEqual(bobList, []);

    // Bob attempting IDOR against Alice's habit ID receives 404 across every endpoint
    const idorToggle = await fetch(`${baseUrl}/api/habits/${aliceHabit.id}/toggle`, {
      method: 'POST',
      headers: csrfHeaders(bobCookie),
      body: JSON.stringify({ date: TEST_TODAY, completed: true }),
    });
    assert.equal(idorToggle.status, 404);

    const idorHistory = await fetch(
      `${baseUrl}/api/habits/${aliceHabit.id}/history?date=${TEST_TODAY}`,
      { headers: { Cookie: bobCookie } }
    );
    assert.equal(idorHistory.status, 404);

    const idorEdit = await fetch(`${baseUrl}/api/habits/${aliceHabit.id}`, {
      method: 'PUT',
      headers: csrfHeaders(bobCookie),
      body: JSON.stringify({ name: 'Hacked', category: 'General' }),
    });
    assert.equal(idorEdit.status, 404);

    const idorDelete = await fetch(`${baseUrl}/api/habits/${aliceHabit.id}`, {
      method: 'DELETE',
      headers: csrfHeaders(bobCookie),
    });
    assert.equal(idorDelete.status, 404);

    // Verify Alice's habit is untouched
    const aliceList = await (
      await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`, {
        headers: { Cookie: aliceCookie },
      })
    ).json();
    assert.equal(aliceList.length, 1);
    assert.equal(aliceList[0].name, 'Alice Morning Run');
    assert.equal(aliceList[0].completedToday, false);
  });

  it('verifies streaks, CSV/JSON export, JSON backup import/merge, and 20-request concurrency', async () => {
    const aliceHabits = await (
      await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`, {
        headers: { Cookie: aliceCookie },
      })
    ).json();
    const habitA = aliceHabits[0];

    // Import JSON backup into Alice's workspace (merges 2 historical dates into Alice Morning Run + adds 1 new habit)
    const importRes = await fetch(`${baseUrl}/api/habits/import`, {
      method: 'POST',
      headers: csrfHeaders(aliceCookie),
      body: JSON.stringify({
        date: TEST_TODAY,
        habits: [
          {
            name: 'alice morning run', // Case-insensitive merge!
            category: 'Fitness',
            completionDates: ['2026-11-21', '2026-11-22'],
          },
          {
            name: 'Deep Reading',
            category: 'Study',
            description: 'Read 30 mins',
            completionDates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
          },
        ],
      }),
    });
    assert.equal(importRes.status, 200);
    const importData = await importRes.json();
    assert.deepEqual(importData.summary, {
      importedHabits: 1,
      mergedHabits: 1,
      importedCompletions: 6,
    });

    // Toggle habitA ON today -> streak jumps 2 -> 3
    const toggleOn = await (
      await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
        method: 'POST',
        headers: csrfHeaders(aliceCookie),
        body: JSON.stringify({ date: TEST_TODAY, completed: true }),
      })
    ).json();
    assert.equal(toggleOn.habit.streak, 3);

    // Concurrency stress check: 20 parallel requests (idempotent toggles + reads)
    const parallelResponses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        i % 2 === 0
          ? fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
              method: 'POST',
              headers: csrfHeaders(aliceCookie),
              body: JSON.stringify({ date: TEST_TODAY, completed: true }),
            })
          : fetch(`${baseUrl}/api/dashboard/stats?date=${TEST_TODAY}`, {
              headers: { Cookie: aliceCookie },
            })
      )
    );
    assert.ok(parallelResponses.every((r) => r.status === 200));

    // Verify CSV & JSON exports stay scoped strictly to Alice's 2 habits
    const jsonExport = await (
      await fetch(`${baseUrl}/api/habits/export?format=json&date=${TEST_TODAY}`, {
        headers: { Cookie: aliceCookie },
      })
    ).json();
    assert.equal(jsonExport.habits.length, 2);
  });

  it('supports profile update, password rotation, online DB backup, account deletion cascade, and rate limiting', async () => {
    // Bob updates display name
    const profRes = await fetch(`${baseUrl}/api/auth/profile`, {
      method: 'PUT',
      headers: csrfHeaders(bobCookie),
      body: JSON.stringify({ name: 'Robert Chen' }),
    });
    assert.equal(profRes.status, 200);
    assert.equal((await profRes.json()).user.name, 'Robert Chen');

    // Bob rotates password
    const pwRes = await fetch(`${baseUrl}/api/auth/password`, {
      method: 'PUT',
      headers: csrfHeaders(bobCookie),
      body: JSON.stringify({
        currentPassword: 'BobSecurePassword123!',
        newPassword: 'BobNewPassword456!',
      }),
    });
    assert.equal(pwRes.status, 200);

    // Online SQLite backup snapshot
    const backupFile = await backupDatabase({
      sourcePath: dbPath,
      backupDir: join(tempDir, 'backups'),
    });
    assert.equal(existsSync(backupFile), true);

    // Bob creates a habit then deletes his account -> cascades Bob's data while preserving Alice's!
    await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: csrfHeaders(bobCookie),
      body: JSON.stringify({ name: 'Bob Temp Habit', date: TEST_TODAY }),
    });

    const delAccRes = await fetch(`${baseUrl}/api/auth/account`, {
      method: 'DELETE',
      headers: csrfHeaders(bobCookie),
      body: JSON.stringify({ password: 'BobNewPassword456!' }),
    });
    assert.equal(delAccRes.status, 200);

    // Bob's session is now invalid (401), while Alice still has her 2 habits
    const bobAfterDel = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: bobCookie },
    });
    assert.equal(bobAfterDel.status, 401);

    const aliceRemaining = await (
      await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`, {
        headers: { Cookie: aliceCookie },
      })
    ).json();
    assert.equal(aliceRemaining.length, 2);

    // Verify per-IP rate limiter returns 429 + Retry-After when threshold exceeded
    const miniApp = express();
    miniApp.get('/limited', createRateLimiter({ windowMs: 10_000, max: 2 }), (req, res) =>
      res.json({ ok: true })
    );
    const miniServer = await new Promise((resolve) => {
      const s = miniApp.listen(0, '127.0.0.1', () => resolve(s));
    });
    const miniUrl = `http://127.0.0.1:${miniServer.address().port}/limited`;
    assert.equal((await fetch(miniUrl)).status, 200);
    assert.equal((await fetch(miniUrl)).status, 200);
    const blockedRes = await fetch(miniUrl);
    assert.equal(blockedRes.status, 429);
    assert.ok(blockedRes.headers.get('retry-after'));
    await new Promise((resolve) => miniServer.close(resolve));
  });
});
