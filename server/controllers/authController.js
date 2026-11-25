import { env } from '../config/env.js';
import { getDb } from '../db/database.js';
import {
  DEMO_USER_EMAIL,
  ensureDemoUserRecord,
  seedStarterHabitsForUser,
} from '../db/seed.js';
import { isRequestSecure } from '../middleware/authMiddleware.js';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  serializeClearCookie,
  serializeSessionCookie,
  verifyPassword,
} from '../utils/authUtils.js';
import { resolveTargetDate } from '../utils/dateUtils.js';

// Precomputed dummy hash so non-existent email sign-ins run scrypt in constant time
const DUMMY_PASSWORD_HASH = hashPassword('ConstantTimeFallback#HabitFlow');

function formatUserResponse(userRow) {
  return {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    isDemo: Boolean(userRow.is_demo),
    createdAt: userRow.created_at,
  };
}

function issueUserSession(db, req, res, userId) {
  const nowMs = Date.now();
  const maxAgeSeconds = env.SESSION_TTL_DAYS * 24 * 60 * 60;
  const expiresIso = new Date(nowMs + maxAgeSeconds * 1000).toISOString();
  const nowIso = new Date(nowMs).toISOString();

  // Opportunistically clean expired sessions
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso);

  const rawToken = generateSessionToken();
  const tokenHash = hashSessionToken(rawToken);

  db.prepare(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).run(userId, tokenHash, expiresIso);

  res.setHeader(
    'Set-Cookie',
    serializeSessionCookie(env.SESSION_COOKIE_NAME, rawToken, {
      maxAgeSeconds,
      secure: isRequestSecure(req),
    })
  );
}

/**
 * POST /api/auth/register
 */
export function registerUser(req, res, next) {
  try {
    const { name, email, password, includeStarterHabits } = req.validatedRegister;
    const todayStr = resolveTargetDate(req.body?.date);
    const db = getDb();

    if (email === DEMO_USER_EMAIL) {
      return res.status(409).json({
        error: 'That email address is reserved for the Demo Explorer account.',
      });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({
        error: 'An account with this email address already exists.',
      });
    }

    const passwordHash = hashPassword(password);

    const createUserTx = db.transaction(() => {
      const info = db
        .prepare(
          'INSERT INTO users (name, email, password_hash, is_demo) VALUES (?, ?, ?, 0)'
        )
        .run(name, email, passwordHash);

      const userId = Number(info.lastInsertRowid);
      if (includeStarterHabits) {
        seedStarterHabitsForUser(db, userId, todayStr);
      }

      return db
        .prepare('SELECT id, name, email, is_demo, created_at FROM users WHERE id = ?')
        .get(userId);
    });

    const createdUser = createUserTx();
    issueUserSession(db, req, res, createdUser.id);

    return res.status(201).json({
      user: formatUserResponse(createdUser),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/login
 */
export function loginUser(req, res, next) {
  try {
    const { email, password } = req.validatedLogin;
    const db = getDb();

    const userRow = db
      .prepare(
        'SELECT id, name, email, password_hash, is_demo, created_at FROM users WHERE email = ?'
      )
      .get(email);

    const candidateHash = userRow ? userRow.password_hash : DUMMY_PASSWORD_HASH;
    const passwordMatches = verifyPassword(password, candidateHash);

    if (!userRow || !passwordMatches) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    issueUserSession(db, req, res, userRow.id);
    return res.status(200).json({
      user: formatUserResponse(userRow),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/demo
 * Instant 1-click sign-in to the pre-seeded Demo Explorer sandbox account.
 */
export function loginDemoUser(req, res, next) {
  try {
    const todayStr = resolveTargetDate(req.body?.date);
    const db = getDb();

    const demoUser = ensureDemoUserRecord(db);
    const habitCount = db
      .prepare('SELECT COUNT(*) AS count FROM habits WHERE user_id = ?')
      .get(demoUser.id).count;

    if (habitCount === 0 && req.body?.seedIfEmpty !== false) {
      seedStarterHabitsForUser(db, demoUser.id, todayStr);
    }

    issueUserSession(db, req, res, demoUser.id);
    return res.status(200).json({
      user: formatUserResponse(demoUser),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/logout
 */
export function logoutUser(req, res, next) {
  try {
    const db = getDb();
    if (req.sessionId) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
    }

    res.setHeader(
      'Set-Cookie',
      serializeClearCookie(env.SESSION_COOKIE_NAME, {
        secure: isRequestSecure(req),
      })
    );
    return res.status(200).json({ message: 'Signed out successfully.' });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/me
 */
export function getCurrentUser(req, res) {
  return res.status(200).json({ user: req.user });
}

/**
 * PUT /api/auth/profile
 */
export function updateProfile(req, res, next) {
  try {
    const { name } = req.validatedProfile;
    const db = getDb();

    db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
    const updated = db
      .prepare('SELECT id, name, email, is_demo, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    return res.status(200).json({ user: formatUserResponse(updated) });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/auth/password
 */
export function changePassword(req, res, next) {
  try {
    if (req.user.isDemo) {
      return res.status(403).json({
        error: 'Password cannot be changed on the shared Demo Explorer account.',
      });
    }

    const { currentPassword, newPassword } = req.validatedPasswordChange;
    const db = getDb();

    const userRow = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user.id);

    if (!userRow || !verifyPassword(currentPassword, userRow.password_hash)) {
      return res.status(401).json({
        error: 'Current password is incorrect.',
      });
    }

    const nextHash = hashPassword(newPassword);
    const updateTx = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
        nextHash,
        req.user.id
      );
      // Revoke all other sessions for this user while keeping current session active
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(
        req.user.id,
        req.sessionId
      );
    });

    updateTx();
    return res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/auth/account
 */
export function deleteAccount(req, res, next) {
  try {
    if (req.user.isDemo) {
      return res.status(403).json({
        error:
          'The shared Demo Explorer account cannot be deleted. Register a personal account to manage account deletion.',
      });
    }

    const confirmPassword =
      typeof req.body?.password === 'string' ? req.body.password : '';
    if (!confirmPassword) {
      return res.status(400).json({
        error: 'Please enter your password to confirm account deletion.',
      });
    }

    const db = getDb();
    const userRow = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user.id);

    if (!userRow || !verifyPassword(confirmPassword, userRow.password_hash)) {
      return res.status(401).json({
        error: 'Incorrect password. Account deletion cancelled.',
      });
    }

    // ON DELETE CASCADE automatically removes sessions, habits, and habit_completions
    db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);

    res.setHeader(
      'Set-Cookie',
      serializeClearCookie(env.SESSION_COOKIE_NAME, {
        secure: isRequestSecure(req),
      })
    );
    return res.status(200).json({
      message: 'Your account and all associated habit data have been permanently deleted.',
    });
  } catch (err) {
    return next(err);
  }
}
