# Scalability Path: 10K → 100K → 1M Users

> Honest assessment: current architecture tested at ~10K users. This document describes the evolution path, not claimed capabilities.

## Current Architecture (10K Users)

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   Node.js       │  Single instance
│   Express +     │  In-memory rate limit
│   Socket.io     │  In-memory presence
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │  Single primary
│   (Prisma)      │  No read replicas
└─────────────────┘
```

**Bottlenecks at 10K:**
- In-memory rate limit → not shared across instances
- In-memory presence → doesn't scale horizontally
- Single PG primary → write throughput limit

---

## 100K Users (Phase 1)

### Changes Required

| Component | Change | Effort |
|-----------|--------|--------|
| Rate Limiting | Redis-backed (`rate-limit-redis`) | Low |
| Caching | Redis for hot reads (workspace/board GET) + invalidation | Medium |
| Socket.io | Redis adapter for pub/sub across instances | Medium |
| PostgreSQL | Read replicas for SELECT queries | Medium |
| Connection Pool | PgBouncer (transaction pooling) | Low |
| Observability | Distributed tracing (OpenTelemetry) | Medium |

### Architecture

```
                    ┌─────────────┐
                    │  Load       │
                    │  Balancer   │  (sticky for WS)
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ Node A   │     │ Node B   │     │ Node C   │
    └────┬─────┘     └────┬─────┘     └────┬─────┘
         │                │                │
         └────────────────┼────────────────┘
                          ▼
                   ┌─────────────┐
                   │   Redis     │  Rate limit + Cache + Socket.io adapter
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ PostgreSQL  │  Primary + Read Replicas
                   │  (Primary)  │  PgBouncer in front
                   └─────────────┘
```

### Implementation Notes

**Redis Caching with Invalidation:**
```javascript
// On workspace GET
const cached = await redis.get(`workspace:${id}`);
if (cached) return JSON.parse(cached);

const workspace = await prisma.workspace.findUnique({ where: { id } });
await redis.set(`workspace:${id}`, JSON.stringify(workspace), 'EX', 60);
return workspace;

// On workspace UPDATE/DELETE
await redis.del(`workspace:${id}`);
await redis.del(`workspace:boards:${id}`);  // related keys
```

**Read Replicas with Prisma:**
```javascript
// prisma.$extends for read/write splitting
const prismaRead = prisma.$extends({
  query: {
    workspace: {
      findMany: { $query: { $read: true } },
      findUnique: { $query: { $read: true } },
    },
  },
});
```

---

## 1M Users (Phase 2)

### Changes Required

| Component | Change | Effort |
|-----------|--------|--------|
| Database | Sharding by `workspaceId` (tenant isolation) | High |
| Search | Elasticsearch (full-text, filters) | High |
| Assets | CDN (Cloudflare R2 / S3 + CloudFront) | Medium |
| Queue | BullMQ / Redis for async jobs (emails, exports) | Medium |
| Multi-region | Active-active or active-passive | High |

### Architecture

```
                    ┌─────────────────┐
                    │  Global LB      │  (GeoDNS, Anycast)
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐
         │ Region  │    │ Region  │    │ Region  │
         │  US-E   │    │  EU-W   │    │  AP-SE  │
         └────┬────┘    └────┬────┘    └────┬────┘
              │              │              │
              ▼              ▼              ▼
         ┌─────────────────────────────────────┐
         │   PostgreSQL (Multi-primary /       │
         │   Citus / Sharded by workspaceId)   │
         └─────────────────────────────────────┘
```

### Sharding Strategy

**Shard by `workspaceId`** (tenant isolation):
- Each workspace's data lives on one shard
- Cross-workspace queries rare (admin only)
- Even distribution: hash(workspaceId) % N

**Schema changes for sharding:**
```prisma
// Add shard key to all tenant-scoped tables
model Task {
  workspaceId String  // Shard key
  boardId     String
  // ...
  @@index([workspaceId, boardId])  // Shard-local queries
}
```

### Search at Scale

PostgreSQL FTS → Elasticsearch when:
- Full-text search across millions of tasks
- Complex filters (assignee + label + date range + text)
- Faceted search / aggregations

```javascript
// Search service abstraction
async function searchTasks({ query, boardId, assigneeId, labels, dueBefore }) {
  if (USE_ELASTICSEARCH) {
    return elasticSearch(query, filters);
  }
  return postgresSearch(query, filters);  // ILIKE + indexes
}
```

---

## Decision Matrix

| Scale | Write Throughput | Read Latency | Complexity |
|-------|------------------|--------------|------------|
| 10K (now) | ~1K/s | ~20ms p99 | Low |
| 100K | ~5K/s | ~15ms p99 | Medium |
| 1M | ~50K/s | ~10ms p99 (cached) | High |

## What We're NOT Doing (Yet)

| Feature | Reason |
|---------|--------|
| Event sourcing | Overkill for CRUD + audit log |
| CQRS | Same model works; separate when read/write diverge |
| GraphQL | REST is explicit, cacheable, interview-relevant |
| Service mesh | Kubernetes-only; not deploying there yet |
| Custom protocol | WebSocket + REST is standard and debuggable |

## Cost Estimate (Monthly, AWS)

| Scale | Compute | Database | Redis | CDN/Other | Total |
|-------|---------|----------|-------|-----------|-------|
| 10K | $50 | $100 | $0 (dev) | $0 | ~$150 |
| 100K | $300 | $500 | $100 | $50 | ~$950 |
| 1M | $2,000 | $3,000 | $500 | $500 | ~$6,000 |

*Estimates only. Actual depends on traffic patterns, data size, region.*