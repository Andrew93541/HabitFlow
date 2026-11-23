/**
 * Returns JSON 404 for unknown API endpoints.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Centralized Express error middleware returning consistent JSON responses.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body.',
    });
  }

  if (typeof err?.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({
      error: 'Database constraint violation: duplicate or invalid record.',
    });
  }

  const statusCode = err?.statusCode || 500;
  const message =
    statusCode >= 500
      ? 'Internal server error while processing your request.'
      : err.message;

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[HabitFlow Server Error]:', err);
  }

  return res.status(statusCode).json({ error: message });
}
