// ============================================
// Opera Server - Entry Point
// ============================================

import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config.js';
import generateRouter from './routes/generate.js';

// ── Validate environment ────────────────────────────────────
validateConfig();

// ── Catch unhandled errors ─────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[opera-server] Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('[opera-server] Unhandled rejection:', err);
});

// ── Create Express app ──────────────────────────────────────
const app = express();

// ── Middleware ───────────────────────────────────────────────

// CORS: allow the frontend dev server
app.use(
  cors({
    origin: [...config.corsOrigins],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// Parse JSON bodies (with a generous limit for long articles)
app.use(express.json({ limit: '1mb' }));

// ── Routes ──────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generation endpoint (SSE streaming)
app.use('/api', generateRouter);

// ── 404 fallback ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global error handler ────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[opera-server] Unhandled error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ── Start server ────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`[opera-server] Running on http://localhost:${config.port}`);
  console.log(`[opera-server] CORS origins: ${config.corsOrigins.join(', ')}`);
  console.log(`[opera-server] Default provider: ${config.defaultProvider}`);
});
