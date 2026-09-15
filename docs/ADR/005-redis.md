# ADR-005: Why Redis?

## Status
Accepted

## Context
Need a fast, ephemeral data store for:
1. Rate limiting (shared across instances)
2. Caching hot reads (workspace/board GET)
3. Socket.io pub/sub for horizontal scaling

## Decision
Use **Redis 7** for all three. In dev, falls back to in-memory.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Redis** | Sub-ms latency, pub/sub, TTL, atomic ops, battle-tested | Extra infrastructure |
| In-memory (Map) | Zero config | Not shared across instances |
| PostgreSQL | Already have it | Too slow for rate limiting, no pub/sub |
| Memcached | Simple caching | No pub/sub, no persistence, no TTL precision |

## Consequences

**Positive:**
- Single tool solves three distinct problems
- Industry standard for rate limiting + caching + pub/sub
- `rate-limit-redis` and `socket.io-redis-adapter` are mature
- Graceful dev fallback (in-memory) via `server/src/utils/redis.js`

**Negative:**
- Extra infrastructure to operate
- Data loss on restart (acceptable for rate limit/cache/presence)

## Implementation

**Rate Limiting:**
```javascript
// express-rate-limit + rate-limit-redis
const { RedisStore } = require('rate-limit-redis');
new RedisStore({ sendCommand: (...args) => redisClient.call(...args) });
```

**Caching:**
```javascript
// Cache-aside with TTL + invalidation
const cached = await redis.get(key);
if (cached) return JSON.parse(cached);
const data = await db.query(...);
await redis.set(key, JSON.stringify(data), 'EX', 60);
return data;
```

**Socket.io Adapter:**
```javascript
const { createAdapter } = require('@socket.io/redis-adapter');
const pub = new Redis(REDIS_URL);
const sub = pub.duplicate();
io.adapter(createAdapter(pub, sub));
```

## Dev Fallback

```javascript
// server/src/utils/redis.js
if (config.redisUrl) {
  // Real Redis
} else {
  // In-memory Map with same API
  // TTL via setTimeout cleanup
}
```

## References
- `server/src/utils/redis.js`
- `server/src/middleware/rateLimiter.js`
- `server/src/socket.js`
- `docs/CACHING.md`