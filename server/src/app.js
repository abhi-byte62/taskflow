const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const { requestId } = require('./middleware/requestId');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler } = require('./middleware/errorHandler');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');

// Build the Express app WITHOUT binding to a port, so tests (supertest) can
// exercise it directly and Socket.io can attach to a custom http server.
// See src/index.js for the entry that wires everything together.
function createApp() {
  const app = express();

  // Security headers (X-Frame-Options, HSTS, nosniff, ...).
  app.use(helmet());

  // Trust proxy so X-Forwarded-For works behind Railway/Render/nginx.
  app.set('trust proxy', 1);

  app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  // Observability: every request gets an id + one structured log line.
  app.use(requestId);
  app.use(requestLogger);

  // Health checks escape rate limiting (monitoring probes + LB health checks).
  app.use('/api/health', healthRoutes);

  // Everything under /api is rate-limited by default.
  app.use('/api', apiLimiter());

  // Auth gets a stricter window (brute-force surface) — composable on top.
  app.use('/api/auth', authLimiter(), authRoutes);

  // ── Business routes attach here (see index.js) ─────────────

  return app;
}

function attachErrorHandling(app) {
  // 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'RESOURCE_NOT_FOUND', message: 'Route not found' },
    });
  });

  // Central error handler (last).
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, attachErrorHandling };