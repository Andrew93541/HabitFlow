import { randomUUID } from 'node:crypto';

/**
 * Attaches X-Request-Id correlation headers and logs structured HTTP access telemetry.
 */
export function requestLogger(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && /^[a-zA-Z0-9-_]{1,64}$/.test(incomingId)
      ? incomingId
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    if (process.env.NODE_ENV === 'production') {
      console.log(
        JSON.stringify({
          level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
          timestamp: new Date().toISOString(),
          requestId,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
        })
      );
    } else if (req.originalUrl.startsWith('/api')) {
      console.log(
        `[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs.toFixed(1)}ms)`
      );
    }
  });

  return next();
}
