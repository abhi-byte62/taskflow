require('dotenv').config();

// Centralized config. Everything environment-dependent lives here so
// the rest of the app stays testable and predictable.
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || '7d',

  // Redis is optional in dev (graceful in-memory fallback) but the real
  // store when REDIS_URL is set — see utils/redis.js and docs/CACHING.md
  redisUrl: process.env.REDIS_URL || undefined,
};

if (!config.jwtSecret) {
  console.error('❌ JWT_SECRET is not set. Copy .env.example to .env first.');
  process.exit(1);
}

module.exports = config;