// Redis wrapper.
//
// When REDIS_URL is set we connect to a real Redis instance and use `ioredis`.
// When it is NOT set (plain `npm run dev`) we fall back to an in-process store
// so the app still runs — but this fallback MUST NOT be used in production;
// deploy with REDIS_URL and redis via docker-compose. See docs/CACHING.md.
//
// Real-world use (all wired into the app):
//   1. Rate limiting (store for express-rate-limit)
//   2. Caching hot reads (workspace/board GET) with TTL + invalidation
//   3. Socket.io pub/sub for scaling across Node instances

const Redis = require('ioredis');
const config = require('../config');
const logger = require('./logger');

let client = null;

// ── Redis client ─────────────────────────────────────────────
if (config.redisUrl) {
  client = new Redis(config.redisUrl, { maxRetriesPerRequest: 2 });

  client.on('connect', () => logger.info('Redis connected'));
  client.on('error', (err) => logger.error('Redis error', { error: err.message }));
} else {
  logger.warn('REDIS_URL not set — using in-memory fallback. For real caching/rate-limit use docker-compose.');
}

// ── In-memory fallback with the same min surface ─────────────
function makeMemoryStore() {
  const map = new Map(); // key -> { value, expiresAt }
  return {
    async get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (hit.expiresAt && hit.expiresAt < Date.now()) {
        map.delete(key);
        return null;
      }
      return hit.value;
    },
    async set(key, value, ttlSeconds) {
      map.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
      return 'OK';
    },
    async del(key) {
      map.delete(key);
      return 1;
    },
    async incr(key) {
      const hit = map.get(key);
      const next = (hit && !expired(hit)) ? Number(hit.value) + 1 : 1;
      map.set(key, { value: next, expiresAt: hit?.expiresAt ?? null });
      return next;
    },
    async expire(key, seconds) {
      const hit = map.get(key);
      if (hit) hit.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },
  };
}

function expired(hit) {
  return hit.expiresAt && hit.expiresAt < Date.now();
}

// Instantiate the fallback store once (not per call).
const memoryStore = makeMemoryStore();

// Expose a cache facade: TTL set, get, delete by pattern (for invalidation).
const cache = {
  async get(key) {
    const raw = client ? await client.get(key) : await memoryStore.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  async set(key, value, ttlSeconds = 60) {
    const val = JSON.stringify(value);
    if (client) return client.set(key, val, 'EX', ttlSeconds);
    return memoryStore.set(key, val, ttlSeconds);
  },
  async del(key) {
    if (client) return client.del(key);
    return memoryStore.del(key);
  },
  async delByPattern(pattern) {
    if (client) {
      const keys = await client.keys(pattern);
      if (keys.length) await client.del(...keys);
    }
    return true;
  },
};

// The store object consumed by express-rate-limit's rate-limit-redis.
function rateLimitStore() {
  if (!client) return undefined; // falls back to built-in memory store
  const { RedisStore } = require('rate-limit-redis');
  return new RedisStore({
    sendCommand: (...args) => client.call(...args),
  });
}

module.exports = { client, cache, rateLimitStore };