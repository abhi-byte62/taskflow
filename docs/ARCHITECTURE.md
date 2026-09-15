# TaskFlow Architecture

## System Overview

TaskFlow is a real-time collaborative Kanban task management application demonstrating production-grade full-stack engineering principles.

## High-Level Data Flow

```
┌─────────────┐     HTTPS (REST)      ┌─────────────┐
│   Browser   │ ◄───────────────────► │   Express   │
│  (React)    │                       │   (Node)    │
└──────┬──────┘                       └──────┬──────┘
       │                                     │
       │         WebSocket (Socket.io)       │
       └─────────────────────────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
              ┌───────────┐            ┌──────────────┐           ┌──────────────┐
              │PostgreSQL │            │    Redis     │           │  Socket.io   │
              │ (Primary) │            │  (Cache/Rate/│           │   Adapter    │
              │           │            │  Socket)     │           │  (Scale-out) │
              └───────────┘            └──────────────┘           └──────────────┘
```

## Key Architectural Decisions

### 1. REST + WebSocket Separation

| Layer | Responsibility |
|-------|----------------|
| **REST** | Create, Read, Update, Delete, Initial data loading |
| **WebSocket** | Live updates, Presence, Typing indicators, Notifications |

**Rule:** Database is the single source of truth. WebSocket events are projections of committed transactions — never state mutations.

### 2. Request Flow (Mutation)

```
POST /tasks
    │
    ▼
Rate Limiter (Redis)
    │
    ▼
Auth Middleware (JWT)
    │
    ▼
Authorize Middleware (RBAC)
    │
    ▼
Zod Validation
    │
    ▼
Idempotency Check
    │
    ▼
Controller → Service
    │
    ▼
Prisma $transaction
    ├── Task CREATE
    ├── ActivityLog CREATE
    └── (Assignees/Labels CREATE)
    │
    ▼
Socket.io emit to board room
    │
    ▼
HTTP 201 + Task JSON
```

### 3. Concurrency Model

**Optimistic Concurrency Control (OCC)** via `Task.version`:

- Every read returns `version`
- Every write sends `version`
- `UPDATE ... WHERE id = ? AND version = ?`
- 0 rows → 409 Conflict → client refetches

This is a real distributed-systems pattern, not academic theory.

### 4. Task Ordering

**Gap-based (fractional) positioning:**

- Initial: 100, 200, 300
- Insert between → midpoint (150)
- Gap < 0.001 → rebalance entire column (100 spacing)
- O(1) insert, O(N) rebalance only when needed

### 5. Database Schema Highlights

| Table | Key Indexes |
|-------|-------------|
| `Task` | `(boardId)`, `(columnId, position)`, `(dueDate)` |
| `WorkspaceMember` | `(workspaceId, userId)` unique, `(userId)` |
| `BoardMember` | `(boardId, userId)` unique, `(userId)` |
| `ActivityLog` | `(boardId, createdAt)`, `(taskId)` |
| `Notification` | `(userId, read)`, `(userId, createdAt)` |
| `IdempotencyKey` | `(key, userId)` unique |

### 6. Observability

Every request gets:
- `X-Request-Id` (UUID, propagated via headers)
- Structured JSON log line: `{ts, level, requestId, method, url, status, durationMs, userId}`

Example:
```json
{"ts":"2026-09-11T18:45:12.123Z","level":"info","msg":"request","requestId":"a1b2-c3d4","method":"POST","url":"/api/tasks/board/abc","status":201,"durationMs":23,"userId":"usr_123"}
```

### 7. Health Checks

| Endpoint | Purpose | Dependencies |
|----------|---------|--------------|
| `GET /api/health` | Liveness (LB probe) | None |
| `GET /api/ready` | Readiness (traffic routing) | PostgreSQL, Redis |

### 8. Security Boundaries

| Layer | Protection |
|-------|------------|
| Transport | HTTPS in prod, CORS restricted |
| Auth | JWT (7d), bcrypt(10), no password in token |
| Authorization | Server-side RBAC on every mutating endpoint |
| Validation | Zod schemas at API boundary |
| Rate Limit | Auth 100/15min, API 1000/15min (Redis) |
| Headers | Helmet (CSP, HSTS, X-Frame-Options, etc.) |
| Idempotency | `Idempotency-Key` on POST `/tasks` |

## Trade-offs Made

| Decision | Trade-off | Rationale |
|----------|-----------|-----------|
| JWT (stateless) | No immediate revocation | Simplicity, horizontal scaling; short expiry mitigates |
| In-memory rate limit (dev) | Not shared across instances | Zero config for local dev; Redis in prod |
| Gap-based ordering | Float precision limits | Rebalances when needed; simpler than linked lists |
| Prisma ORM | Abstraction overhead | Type safety, migrations, developer velocity |
| Socket.io | Extra dependency vs raw WS | Auto-reconnect, rooms, fallbacks, battle-tested |

## What's Not Included (Intentional)

- **Elasticsearch** — PostgreSQL FTS is sufficient until proven otherwise
- **Email/Notifications** — Core loop first; notifications via Socket.io only
- **File attachments** — Adds storage complexity; not core to Kanban
- **Multi-region** — Premature optimization; documented in SCALABILITY.md
- **GraphQL** — REST is explicit, cacheable, and interview-relevant