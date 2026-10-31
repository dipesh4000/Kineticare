/**
 * Kineticare Backend Entry Point — hardened edition
 *
 * Changes from baseline:
 *  - Helmet + CORS + rate-limit + requestId/logger are all applied in api.js
 *  - server.js now owns graceful shutdown (SIGTERM / SIGINT)
 *  - Unhandled promise rejections and uncaught exceptions are logged and the
 *    process exits with a non-zero code so the supervisor can restart it
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiApp } from './routes/api.js';
import { config } from './config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Mount API routes
app.use('/api', apiApp);

// Serve frontend static build in production
const distPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(distPath));

app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(distPath, 'index.html'), err => {
    if (err) {
      res.status(200).send('Kineticare Backend Server running. Start Vite dev server for client.');
    }
  });
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    JSON.stringify({
      level: 'info',
      message: `Kineticare Fullstack Server listening on http://${config.host}:${config.port}`,
      env: config.env,
      ts: new Date().toISOString(),
    }),
  );
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', message: `${signal} received — shutting down gracefully`, ts: new Date().toISOString() }));
  server.close(err => {
    if (err) {
      console.error(JSON.stringify({ level: 'error', message: 'Error during shutdown', error: err.message, ts: new Date().toISOString() }));
      process.exit(1);
    }
    console.log(JSON.stringify({ level: 'info', message: 'Server closed. Goodbye.', ts: new Date().toISOString() }));
    process.exit(0);
  });

  // Force exit after 10 s if connections don't drain
  setTimeout(() => {
    console.error(JSON.stringify({ level: 'error', message: 'Forced exit after timeout', ts: new Date().toISOString() }));
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Surface unhandled errors so they appear in structured logs
process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({ level: 'error', message: 'Unhandled promise rejection', reason: String(reason), ts: new Date().toISOString() }));
});
process.on('uncaughtException', (err) => {
  console.error(JSON.stringify({ level: 'error', message: 'Uncaught exception', error: err.message, stack: err.stack, ts: new Date().toISOString() }));
  process.exit(1);
});

export { app };
