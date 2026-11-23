import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app.js';
import { closeDb, createDatabaseConnection, setDb } from '../db/database.js';

describe('HabitFlow REST API & SQLite Persistence Integration Suite', () => {
  let server;
  let baseUrl;
  let tempDir;
  let dbPath;
  let db;
  const TEST_TODAY = '2026-11-23';

  before(async () => {
    process.env.NODE_ENV = 'test';
    tempDir = mkdtempSync(join(tmpdir(), 'habitflow-test-'));
    dbPath = join(tempDir, 'test-habits.db');
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

  it('GET /api/health returns healthy status and security headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('starts with an empty list and zeroed dashboard stats', async () => {
    const [habitsRes, statsRes] = await Promise.all([
      fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`),
      fetch(`${baseUrl}/api/dashboard/stats?date=${TEST_TODAY}`),
    ]);

    assert.equal(habitsRes.status, 200);
    assert.deepEqual(await habitsRes.json(), []);

    assert.equal(statsRes.status, 200);
    const stats = await statsRes.json();
    assert.deepEqual(stats, {
      totalHabits: 0,
      completedToday: 0,
      pendingToday: 0,
      bestStreak: 0,
      date: TEST_TODAY,
    });
  });

  it('validates input payloads and safely handles SQL injection strings', async () => {
    const emptyRes = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(emptyRes.status, 400);

    const badDateRes = await fetch(`${baseUrl}/api/habits?date=2026-99-99`);
    assert.equal(badDateRes.status, 400);

    // SQL injection payload must be stored safely as literal text via prepared statements
    const sqliName = "Read '; DROP TABLE habits; --";
    const sqliRes = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sqliName, description: 'Safe test', date: TEST_TODAY }),
    });
    assert.equal(sqliRes.status, 201);
    const created = await sqliRes.json();
    assert.equal(created.name, sqliName);

    // Clean up SQLi test habit
    const delRes = await fetch(`${baseUrl}/api/habits/${created.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
  });

  it('maintains independent streaks, prevents duplicate completions, and recalculates on uncheck', async () => {
    // Create Habit A and Habit B
    const resA = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morning Run',
        description: '5km outdoor jog',
        date: TEST_TODAY,
      }),
    });
    const habitA = await resA.json();

    const resB = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Drink Water',
        description: '8 glasses daily',
        date: TEST_TODAY,
      }),
    });
    const habitB = await resB.json();

    // Seed historical completions for Habit A: completed 2026-11-21 and 2026-11-22 (2-day streak through yesterday)
    db.prepare('INSERT INTO habit_completions (habit_id, completion_date) VALUES (?, ?)').run(
      habitA.id,
      '2026-11-21'
    );
    db.prepare('INSERT INTO habit_completions (habit_id, completion_date) VALUES (?, ?)').run(
      habitA.id,
      '2026-11-22'
    );

    // Seed broken completion for Habit B: completed 2026-11-20, missed 2026-11-21 and 2026-11-22 -> streak 0
    db.prepare('INSERT INTO habit_completions (habit_id, completion_date) VALUES (?, ?)').run(
      habitB.id,
      '2026-11-20'
    );

    // Before checking today: Habit A has streak 2, Habit B has streak 0
    const beforeList = await (await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`)).json();
    const beforeA = beforeList.find((h) => h.id === habitA.id);
    const beforeB = beforeList.find((h) => h.id === habitB.id);
    assert.equal(beforeA.streak, 2);
    assert.equal(beforeA.completedToday, false);
    assert.equal(beforeB.streak, 0);
    assert.equal(beforeB.completedToday, false);

    // Check Habit A today -> Habit A becomes completedToday=true, streak=3; Habit B stays 0!
    const toggleARes = await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: TEST_TODAY, completed: true }),
    });
    assert.equal(toggleARes.status, 200);
    const toggleAData = await toggleARes.json();
    assert.equal(toggleAData.habit.completedToday, true);
    assert.equal(toggleAData.habit.streak, 3);
    assert.equal(toggleAData.stats.completedToday, 1);
    assert.equal(toggleAData.stats.pendingToday, 1);
    assert.equal(toggleAData.stats.bestStreak, 3);

    // Sending completed: true a SECOND time on the same day must NOT create a duplicate or increment twice
    const duplicateToggleRes = await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: TEST_TODAY, completed: true }),
    });
    const duplicateData = await duplicateToggleRes.json();
    assert.equal(duplicateData.habit.streak, 3);

    const rowCount = db
      .prepare('SELECT COUNT(*) AS count FROM habit_completions WHERE habit_id = ? AND completion_date = ?')
      .get(habitA.id, TEST_TODAY).count;
    assert.equal(rowCount, 1);

    // Verify DB UNIQUE constraint directly rejects raw duplicate insert
    assert.throws(() => {
      db.prepare('INSERT INTO habit_completions (habit_id, completion_date) VALUES (?, ?)').run(
        habitA.id,
        TEST_TODAY
      );
    }, /UNIQUE constraint failed/);

    // Verify Habit B was completely unaffected
    const midList = await (await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`)).json();
    const midB = midList.find((h) => h.id === habitB.id);
    assert.equal(midB.completedToday, false);
    assert.equal(midB.streak, 0);

    // Uncheck Habit A today -> recalculates back to 2 (earned through yesterday)
    const uncheckARes = await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: TEST_TODAY, completed: false }),
    });
    const uncheckAData = await uncheckARes.json();
    assert.equal(uncheckAData.habit.completedToday, false);
    assert.equal(uncheckAData.habit.streak, 2);

    // Check and uncheck Habit B (which had 0 active streak) -> 0 -> 1 -> 0 (never below 0)
    const checkB = await (
      await fetch(`${baseUrl}/api/habits/${habitB.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TEST_TODAY }),
      })
    ).json();
    assert.equal(checkB.habit.streak, 1);

    const uncheckB = await (
      await fetch(`${baseUrl}/api/habits/${habitB.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TEST_TODAY }),
      })
    ).json();
    assert.equal(uncheckB.habit.streak, 0);
  });

  it('supports editing habits, persists across DB reconnects, and cascades deletes', async () => {
    const listBefore = await (await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`)).json();
    const target = listBefore[0];

    // Edit habit name and description
    const editRes = await fetch(`${baseUrl}/api/habits/${target.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morning Trail Run',
        description: 'Updated description',
        date: TEST_TODAY,
      }),
    });
    assert.equal(editRes.status, 200);
    const edited = await editRes.json();
    assert.equal(edited.name, 'Morning Trail Run');
    assert.equal(edited.description, 'Updated description');
    assert.equal(edited.streak, 2); // Streak preserved after edit!

    // Simulate browser refresh / server restart by closing and reopening the SQLite file
    closeDb();
    db = createDatabaseConnection(dbPath, { autoSeed: false });
    setDb(db);

    const afterReconnect = await (await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`)).json();
    const persisted = afterReconnect.find((h) => h.id === target.id);
    assert.equal(persisted.name, 'Morning Trail Run');
    assert.equal(persisted.streak, 2);

    // Delete habit and verify ON DELETE CASCADE removes its completion rows
    const completionsBefore = db
      .prepare('SELECT COUNT(*) AS count FROM habit_completions WHERE habit_id = ?')
      .get(target.id).count;
    assert.equal(completionsBefore > 0, true);

    const deleteRes = await fetch(`${baseUrl}/api/habits/${target.id}`, {
      method: 'DELETE',
    });
    assert.equal(deleteRes.status, 200);

    const completionsAfter = db
      .prepare('SELECT COUNT(*) AS count FROM habit_completions WHERE habit_id = ?')
      .get(target.id).count;
    assert.equal(completionsAfter, 0);
  });
});
