const rateLimit = require('express-rate-limit');
const { rateLimitStore } = require('../utils/redis');

// Rate limiting setup.
//  - Backend configurable per-limit via the `store` argument.
//  - With REDIS_URL set the counter is shared across instances (scales).
//  - Without it, express-rate-limit uses its built-in memory store (dev only).
//
// These factory functions let app.js pass one shared Redis store in.

function authLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore(),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' } },
  });
}

function apiLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    store: rateLimitStore(),
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'Rate limit exceeded' } },
  });
}

module.exports = { authLimiter, apiLimiter };