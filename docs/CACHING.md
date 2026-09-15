# Caching Strategy

## Redis Usage (3 Real Places)

### 1. Rate Limiting
```javascript
// server/src/middleware/rateLimiter.js
// Uses rate-limit-redis store when REDIS_URL set
// Falls back to in-memory in dev
```

**Why:** Shared counter across Node instances. Critical for horizontal scaling.

### 2. Hot Read Caching (Workspace/Board GET)

```javascript
// Pattern: GET /api/workspaces/:id
const cached = await redis.get(`workspace:${id}`);
if (cached) return JSON.parse(cached);

const workspace = await prisma.workspace.findUnique({ where: { id } });
await redis.set(`workspace:${id}`, JSON.stringify(workspace), 'EX', 60);
return workspace;

// Invalidation on write:
await redis.del(`workspace:${id}`);
await redis.del(`workspace:boards:${id}`);
```

**What to cache:** Frequently read, infrequently written resources (workspaces, boards, labels).

**What NOT to cache:** Tasks (high write volume, per-user permissions), activity feed (personalized), notifications (personalized).

### 3. Socket.io Horizontal Scaling

```javascript
// server/src/socket.js
// When REDIS_URL + multiple Node instances:
const { createAdapter } = require('@socket.io/redis-adapter');
const pubClient = new Redis(config.redisUrl);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
```

**Why:** Broadcast `task.moved` from Node A to clients connected to Node B.

## Cache Invalidation Rules

| Resource | Cache Key | TTL | Invalidate On |
|----------|-----------|-----|---------------|
| Workspace | `workspace:${id}` | 60s | UPDATE, DELETE |
| Workspace boards | `workspace:boards:${id}` | 60s | Board CREATE/DELETE |
| Board | `board:${id}` | 60s | UPDATE, DELETE |
| Board data (cols+tasks) | `board:data:${id}` | 30s | Any task/column mutation |
| Labels | `board:labels:${boardId}` | 120s | Label CREATE/UPDATE/DELETE |

## Cache-Aside Pattern

```javascript
async function getWorkspace(id) {
  const key = `workspace:${id}`;
  
  // 1. Check cache
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  // 2. Fetch from DB
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) return null;
  
  // 3. Store in cache
  await redis.set(key, JSON.stringify(workspace), 'EX', 60);
  return workspace;
}
```

## What We Don't Cache

| Resource | Reason |
|----------|--------|
| Task list | High write volume, personalized (permissions) |
| Activity feed | Personalized, real-time requirements |
| Notifications | Per-user, real-time via Socket.io |
| User session | JWT is stateless |

## Dev vs Prod

| Environment | Rate Limit | Caching | Socket Scaling |
|-------------|------------|---------|----------------|
| Dev | In-memory | Disabled | Single instance |
| Prod | Redis | Redis | Redis adapter |

**Dev fallback:** `server/src/utils/redis.js` provides in-memory store with same API so code doesn't branch.

## Cache Invalidation Testing

```javascript
test('workspace cache invalidated on update', async () => {
  const workspace = await createWorkspace();
  
  // Prime cache
  await api.get(`/workspaces/${workspace.id}`);
  expect(await redis.get(`workspace:${workspace.id}`)).toBeTruthy();
  
  // Mutate
  await api.patch(`/workspaces/${workspace.id}`, { name: 'New name' });
  
  // Cache should be gone
  expect(await redis.get(`workspace:${workspace.id}`)).toBeNull();
});
```