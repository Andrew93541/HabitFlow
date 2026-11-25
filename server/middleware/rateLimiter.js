/**
 * Creates a lightweight, memory-safe per-IP rate limiting middleware.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 120,
  message = 'Too many requests. Please slow down and try again shortly.',
} = {}) {
  const hits = new Map();

  // Periodically sweep expired buckets so memory stays bounded
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of hits.entries()) {
      if (bucket.resetAt <= now) {
        hits.delete(key);
      }
    }
  }, Math.min(windowMs, 60_000));
  cleanupTimer.unref?.();

  return function rateLimiterMiddleware(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let bucket = hits.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      hits.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}
