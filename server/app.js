import cors from 'cors';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import { getLocalDateString } from './utils/dateUtils.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const clientDistDir = resolve(currentDir, '..', 'client', 'dist');

export function createApp() {
  const app = express();

  // Basic security headers
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
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
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    })
  );

  app.use(express.json({ limit: '32kb' }));

  // Health & diagnostics endpoint
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'HabitFlow API',
      localDate: getLocalDateString(),
    });
  });

  // REST API routes
  app.use('/api/habits', habitRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // API 404 handler
  app.use('/api', notFoundHandler);

  // Optional production static file serving when client/dist is built
  if (env.NODE_ENV === 'production' && existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res) => {
      res.sendFile(resolve(clientDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}

const app = createApp();
export default app;
