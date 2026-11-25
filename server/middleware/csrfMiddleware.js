const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protects state-changing cookie-authenticated API endpoints against CSRF
 * by requiring the custom `X-Requested-With: HabitFlow` header.
 * Cross-origin HTML forms cannot set custom headers, and cross-origin fetch
 * preflights are restricted by CORS policy.
 */
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const headerVal = req.headers['x-requested-with'];
  if (headerVal !== 'HabitFlow') {
    return res.status(403).json({
      error: 'CSRF verification failed: missing required X-Requested-With header.',
    });
  }

  return next();
}
