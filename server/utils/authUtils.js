import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

/**
 * Hashes a plaintext password using memory-hard scrypt with a unique 16-byte random salt.
 */
export function hashPassword(plainPassword) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash in constant time.
 */
export function verifyPassword(plainPassword, storedHash) {
  if (typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, expectedHex] = parts;
  const expectedBuffer = Buffer.from(expectedHex, 'hex');
  if (expectedBuffer.length !== KEY_LENGTH) {
    return false;
  }

  const actualBuffer = scryptSync(plainPassword, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

/**
 * Generates a high-entropy 256-bit opaque session token.
 */
export function generateSessionToken() {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes a raw session token with SHA-256 before database storage or lookup.
 */
export function hashSessionToken(rawToken) {
  return createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Safely parses a raw HTTP Cookie header into a null-prototype dictionary.
 */
export function parseCookies(cookieHeader) {
  const cookies = Object.create(null);
  if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) {
    return cookies;
  }

  for (const pair of cookieHeader.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = pair.slice(0, eqIndex).trim();
    const rawValue = pair.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

/**
 * Serializes an HttpOnly session cookie with SameSite=Lax and optional Secure flag.
 */
export function serializeSessionCookie(name, token, { maxAgeSeconds, secure = false }) {
  const attributes = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeSeconds)}`,
  ];
  if (secure) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}

/**
 * Serializes an expired cookie header to clear the session cookie on sign-out.
 */
export function serializeClearCookie(name, { secure = false } = {}) {
  const attributes = [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ];
  if (secure) {
    attributes.push('Secure');
  }
  return attributes.join('; ');
}
