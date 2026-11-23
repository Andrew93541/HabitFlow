import app from './app.js';
import { env } from './config/env.js';
import { closeDb, getDb } from './db/database.js';

// Initialize SQLite database & initial sample data on server startup
getDb();

const server = app.listen(env.PORT, () => {
  console.log(`HabitFlow API server running on http://localhost:${env.PORT}`);
});

function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Closing HTTP server and SQLite connection...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
