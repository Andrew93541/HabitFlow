import { env } from '../config/env.js';
import { getDb } from '../db/database.js';
import {
  hashSessionToken,
  parseCookies,
  serializeClearCookie,
} from '../utils/authUtils.js';

export function isRequestSecure(req) {
  return Boolean(
    req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      process.env.COOKIE_SECURE === 'true'
  );
}

/**
 * Authenticates requests via the HttpOnly session cookie and populates `req.user`.
 */
export function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const rawToken = cookies[env.SESSION_COOKIE_NAME];

    if (!rawToken) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in to continue.',
      });
    }

    const db = getDb();
    const tokenHash = hashSessionToken(rawToken);
    const nowIso = new Date().toISOString();

    const row = db
      .prepare(
        `SELECT
           s.id AS session_id,
           s.expires_at,
           u.id,
           u.name,
           u.email,
           u.is_demo,
           u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ?`
      )
      .get(tokenHash, nowIso);

    if (!row) {
      res.setHeader(
        'Set-Cookie',
        serializeClearCookie(env.SESSION_COOKIE_NAME, {
          secure: isRequestSecure(req),
        })
      );
      return res.status(401).json({
        error: 'Your session has expired. Please sign in again.',
      });
    }

    req.sessionId = row.session_id;
    req.user = {
      id: row.id,
      name: row.name,
      email: row.email,
      isDemo: Boolean(row.is_demo),
      createdAt: row.created_at,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}
