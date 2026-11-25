import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { getDb } from './db/database.js';
import { csrfProtection } from './middleware/csrfMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createRateLimiter } from './middleware/rateLimiter.js';
import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import { getLocalDateString } from './utils/dateUtils.js';
import { requestLogger } from './utils/logger.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDistDir = resolve(currentDir, '..', 'client', 'dist');

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use(requestLogger);

  // Hardened HTTP security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self';"
    );
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }
    next();
  });

  const allowedOrigins = new Set([
    env.CLIENT_ORIGIN,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
  ]);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
    })
  );

  // Allow up to 512kb for JSON backup imports while keeping payloads bounded
  app.use(express.json({ limit: '512kb' }));

  // Deep readiness health probe (unauthenticated for load balancers / Docker HEALTHCHECK)
  app.get('/api/health', (req, res) => {
    try {
      const db = getDb();
      const probe = db.prepare('SELECT 1 AS ok').get();
      return res.status(200).json({
        status: probe?.ok === 1 ? 'ok' : 'degraded',
        service: 'HabitFlow API',
        version: '2.0.0',
        database: 'connected',
        uptimeSeconds: Math.floor(process.uptime()),
        localDate: getLocalDateString(),
      });
    } catch {
      return res.status(503).json({
        status: 'unhealthy',
        service: 'HabitFlow API',
        database: 'disconnected',
      });
    }
  });

  // Global API rate limit & CSRF protection
  const apiRateLimiter = createRateLimiter({
    windowMs: 60_000,
    max: Number(process.env.API_RATE_LIMIT_MAX) || 240,
  });

  app.use('/api', apiRateLimiter, csrfProtection);

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/habits', habitRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // API 404 handler
  app.use('/api', notFoundHandler);

  // Production static SPA serving when client/dist exists
  if (env.IS_PROD && existsSync(clientDistDir)) {
    app.use(
      '/assets',
      express.static(resolve(clientDistDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );
    app.use(
      express.static(clientDistDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(resolve(clientDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
