# HabitFlow Security Architecture & Threat Controls

## 1. Authentication & Password Storage
- **Memory-Hard KDF (`crypto.scrypt`):** Passwords are hashed using Node's native `scrypt` (`N=16384, r=8, p=1`, 64-byte output) with a unique 16-byte CSPRNG salt per user.
- **Constant-Time Verification:** Login checks use `crypto.timingSafeEqual` and verify against a precomputed dummy scrypt hash when an email does not exist, preventing timing-based account enumeration.
- **Session Hygiene:** Changing a user's password automatically revokes all other active sessions for that user.

## 2. Session & Cookie Security
- **Hashed Opaque Session Tokens:** Sessions use 256-bit random tokens (`randomBytes(32)`). Only the **SHA-256 digest** is stored in `sessions.token_hash`, so a database backup/read leak cannot be used to hijack active sessions.
- **`HttpOnly` Cookie Transport:** Tokens are stored in `HttpOnly; SameSite=Lax` cookies (never exposed to `localStorage` or JavaScript XSS) and automatically include `Secure` when served over HTTPS (`req.secure` / `X-Forwarded-Proto: https`).

## 3. Cross-Site & Abuse Protections
- **CSRF Defense-in-Depth:** Every mutating `/api` request (`POST`, `PUT`, `PATCH`, `DELETE`) requires `X-Requested-With: HabitFlow` alongside `SameSite=Lax` cookies and strict CORS origin allowlisting.
- **Per-IP Rate Limiting:** Brute-force rate limiting protects `/api/auth/*` (`25` attempts / `15` min) and `/api/*` (`240` requests / min), returning `429 Too Many Requests` with `Retry-After`.
- **Strict Tenant Isolation (Anti-IDOR):** Every SQL `SELECT`, `UPDATE`, and `DELETE` on `habits` enforces `WHERE user_id = ?` (`req.user.id`), returning `404` on cross-tenant IDs.

## 4. Injection, Headers & Container Hardening
- **SQL Injection:** 100% parameterized prepared statements via `better-sqlite3`.
- **CSV Formula Injection:** Cells starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are prefixed with `'` during CSV export.
- **HTTP Headers:** `Content-Security-Policy`, `Strict-Transport-Security` (over HTTPS), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Permissions-Policy`, and `Referrer-Policy`.
- **Non-Root Container Runtime:** The production `Dockerfile` strips compiler toolchains in the final stage and runs under the unprivileged `node` user.
