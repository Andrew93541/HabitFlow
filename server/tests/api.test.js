import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../app.js';
import { closeDb, createDatabaseConnection, initializeSchema, setDb } from '../db/database.js';

describe('HabitFlow REST API, Categories, Calendar History & Export Suite', () => {
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

  it('migrates a legacy v1 SQLite table (without category column) non-destructively', () => {
    const legacyPath = join(tempDir, 'legacy-v1.db');
    const legacyDb = new Database(legacyPath);
    legacyDb.exec(`
      CREATE TABLE habits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
      INSERT INTO habits (name, description) VALUES ('Morning Hydration (500ml Water)', 'Legacy row');
    `);

    initializeSchema(legacyDb);
    const migratedRow = legacyDb.prepare('SELECT name, category, description FROM habits').get();
    assert.equal(migratedRow.name, 'Morning Hydration (500ml Water)');
    assert.equal(migratedRow.category, 'Health');
    assert.equal(migratedRow.description, 'Legacy row');
    legacyDb.close();
  });

  it('GET /api/health returns healthy status and security headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  it('validates input payloads, categories, and safely handles SQL injection strings', async () => {
    const emptyRes = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(emptyRes.status, 400);

    const invalidCatRes = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', category: 'InvalidCategoryName' }),
    });
    assert.equal(invalidCatRes.status, 400);

    const sqliName = "Read '; DROP TABLE habits; --";
    const sqliRes = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sqliName, description: 'Safe test', date: TEST_TODAY }),
    });
    assert.equal(sqliRes.status, 201);
    const created = await sqliRes.json();
    assert.equal(created.name, sqliName);
    assert.equal(created.category, 'General');

    await fetch(`${baseUrl}/api/habits/${created.id}`, { method: 'DELETE' });
  });

  it('maintains independent streaks, categories, history endpoint, and exports CSV/JSON', async () => {
    const resA = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morning Run',
        category: 'Fitness',
        description: '5km outdoor jog',
        date: TEST_TODAY,
      }),
    });
    const habitA = await resA.json();
    assert.equal(habitA.category, 'Fitness');

    const resB = await fetch(`${baseUrl}/api/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Drink Water',
        category: 'Health',
        description: '8 glasses daily',
        date: TEST_TODAY,
      }),
    });
    const habitB = await resB.json();
    assert.equal(habitB.category, 'Health');

    // Category filter via query parameter
    const fitnessOnly = await (
      await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}&category=Fitness`)
    ).json();
    assert.equal(fitnessOnly.length, 1);
    assert.equal(fitnessOnly[0].name, 'Morning Run');

    // Seed historical completions for Habit A: 2026-10-01..04 (4-day historical best) + 2026-11-21..22 (2-day active)
    for (const d of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-21', '2026-11-22']) {
      db.prepare('INSERT INTO habit_completions (habit_id, completion_date) VALUES (?, ?)').run(
        habitA.id,
        d
      );
    }

    // Seed broken completion for Habit B
    db.prepare('INSERT INTO habit_completions (habit_id, completion_date) VALUES (?, ?)').run(
      habitB.id,
      '2026-11-20'
    );

    // Check Habit A today -> streak 2 -> 3, longestStreak remains 4
    const toggleARes = await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: TEST_TODAY, completed: true }),
    });
    const toggleAData = await toggleARes.json();
    assert.equal(toggleAData.habit.completedToday, true);
    assert.equal(toggleAData.habit.streak, 3);
    assert.equal(toggleAData.habit.longestStreak, 4);

    // Duplicate same-day toggle protection
    const duplicateData = await (
      await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TEST_TODAY, completed: true }),
      })
    ).json();
    assert.equal(duplicateData.habit.streak, 3);

    // Verify GET /api/habits/:id/history for Monthly Calendar Heatmap Modal
    const historyRes = await fetch(
      `${baseUrl}/api/habits/${habitA.id}/history?date=${TEST_TODAY}`
    );
    assert.equal(historyRes.status, 200);
    const historyBody = await historyRes.json();
    assert.equal(historyBody.streak, 3);
    assert.equal(historyBody.longestStreak, 4);
    assert.equal(historyBody.totalCompletions, 7);
    assert.ok(historyBody.completionDates.includes(TEST_TODAY));
    assert.ok(historyBody.completionDates.includes('2026-10-04'));

    // Verify CSV Export endpoint
    const csvRes = await fetch(
      `${baseUrl}/api/habits/export?format=csv&date=${TEST_TODAY}`
    );
    assert.equal(csvRes.status, 200);
    assert.match(csvRes.headers.get('content-disposition'), /habitflow-export-2026-11-23\.csv/);
    const csvText = await csvRes.text();
    assert.ok(csvText.includes('Habit ID,Habit Name,Category'));
    assert.ok(csvText.includes('Morning Run,Fitness'));

    // Verify JSON Export endpoint
    const jsonRes = await fetch(
      `${baseUrl}/api/habits/export?format=json&date=${TEST_TODAY}`
    );
    assert.equal(jsonRes.status, 200);
    assert.match(jsonRes.headers.get('content-disposition'), /habitflow-export-2026-11-23\.json/);
    const jsonExport = await jsonRes.json();
    assert.equal(jsonExport.summary.totalHabits, 2);
    assert.equal(jsonExport.habits[0].completionDates.length, 7);

    // Uncheck Habit A -> reverts to 2
    const uncheckAData = await (
      await fetch(`${baseUrl}/api/habits/${habitA.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: TEST_TODAY, completed: false }),
      })
    ).json();
    assert.equal(uncheckAData.habit.streak, 2);
  });

  it('supports editing category/details and cascades deletes', async () => {
    const listBefore = await (await fetch(`${baseUrl}/api/habits?date=${TEST_TODAY}`)).json();
    const target = listBefore[0];

    const editRes = await fetch(`${baseUrl}/api/habits/${target.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Morning Trail Run',
        category: 'Mindfulness',
        description: 'Updated description',
        date: TEST_TODAY,
      }),
    });
    assert.equal(editRes.status, 200);
    const edited = await editRes.json();
    assert.equal(edited.name, 'Morning Trail Run');
    assert.equal(edited.category, 'Mindfulness');

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
