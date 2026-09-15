const express = require('express');
const prisma = require('../utils/prisma');
const { client: redisClient } = require('../utils/redis');

const router = express.Router();

/**
 * GET /api/health — liveness.
 * The process is up. No dependency checks (load balancer probes this).
 */
router.get('/', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * GET /api/ready — readiness.
 * Process is up AND critical dependencies (Postgres, Redis when configured)
 * are reachable. A platform that supports it can route traffic around a
 * node whose deps are down without killing it.
 */
router.get('/ready', async (req, res) => {
  const checks = { api: 'ok' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.postgres = 'ok';
  } catch (err) {
    checks.postgres = 'down';
  }

  if (redisClient) {
    try {
      await redisClient.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'down';
    }
  } else {
    checks.redis = 'not_configured';
  }

  const ready = Object.values(checks).every((v) => v === 'ok' || v === 'not_configured');
  res.status(ready ? 200 : 503).json({ ready, checks });
});

module.exports = router;