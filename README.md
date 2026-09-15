# TaskFlow — Collaborative Task Management

> A production-grade, real-time Kanban board built to demonstrate system design, full-stack engineering, and FAANG-level interview readiness.

![TaskFlow Architecture](docs/architecture.png)

## 🎯 Why This Project Exists

Built by a 4th-year CSE student targeting FAANG SWE/Full-Stack roles. Every architectural decision is intentional — this isn't a "Trello clone" tutorial; it's a conversation starter for system design interviews.

**Interview talking points baked in:**
- **RBAC enforced server-side** — never trust the client
- **Optimistic concurrency** (Task.version → 409 Conflict) — real distributed-systems problem
- **Gap-based ordering** (100, 200, 300 → midpoints) — avoids O(N) renumbering
- **Idempotency keys** on mutating endpoints — duplicate-safe retries
- **Prisma $transaction** — atomic task + audit log writes
- **REST (CRUD) vs WebSocket (live updates)** — DB is source of truth
- **Cursor pagination** — no offset pagination at scale
- **Audit trail** — who did what, when, where
- **Structured logging + request IDs** — trace a request across the stack

## 🏗️ Architecture

```
┌─────────────────┐     REST API      ┌──────────────────┐
│                  │ ◄───────────────► │                  │
│   React + Vite   │                   │  Express + Prisma │
│   Tailwind CSS   │     WebSocket     │  Socket.io       │
│                  │ ◄───────────────► │                  │
└─────────────────┘                   └────────┬─────────┘
                                               │
                                    ┌──────────┴──────────┐
                                    │                     │
                               ┌────▼─────┐        ┌──────▼──────┐
                               │PostgreSQL│        │    Redis     │
                               │  (Prisma)│        │(cache/rate/   │
                               └──────────┘        │  socket)     │
                                                   └─────────────┘
```

### Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | React 18 + Vite + Tailwind CSS | Modern, fast, type-safe |
| State | TanStack Query (React Query) | Server state, optimistic updates, caching |
| Drag & Drop | @dnd-kit/core + sortable | Accessible (keyboard + ARIA), headless |
| Realtime | Socket.io client | WebSocket with auto-reconnect, rooms |
| Backend | Node.js + Express | Industry standard, minimal boilerplate |
| ORM | Prisma | Type-safe DB access, migrations |
| DB | PostgreSQL 17 | Relational, ACID, production-grade |
| Cache/Rate | Redis (optional in dev) | Rate limiting, caching, socket scaling |
| Auth | JWT + bcryptjs | Stateless, secure password hashing |
| Validation | Zod | Schema-first, runtime + compile-time |
| Testing | Node.js native test runner | Zero-config, fast |

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 17+ (running on port 5432, user `postgres`, password `postgres`)
- Redis (optional — falls back to in-memory in dev)

### 1. Clone & Install
```bash
git clone <repo-url>
cd taskflow

# Server
cd server
npm install
cp .env.example .env
# Edit .env if needed (defaults work for local)

# Client
cd ../client
npm install
```

### 2. Database Setup
```bash
cd server
npx prisma db push        # Create schema
npx prisma db seed        # Demo user: demo@taskflow.dev / password123
```

### 3. Run Both Servers
```bash
# Terminal 1: Backend (port 5000)
cd server && npm run dev

# Terminal 2: Frontend (port 5173)
cd client && npm run dev
```

Open http://localhost:5173 → Login with `demo@taskflow.dev` / `password123`

## 📁 Project Structure

```
taskflow/
├── server/
│   ├── src/
│   │   ├── index.js              # Entry: Express + Socket.io
│   │   ├── app.js                # Express app factory (testable)
│   │   ├── config.js             # Centralized config
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verification
│   │   │   ├── authorize.js      # RBAC (owner/admin/member/viewer)
│   │   │   ├── validate.js       # Zod schema validation
│   │   │   ├── idempotency.js    # Idempotency key middleware
│   │   │   ├── rateLimiter.js    # Redis-backed rate limiting
│   │   │   ├── requestId.js      # Correlation IDs
│   │   │   ├── requestLogger.js  # Structured request logging
│   │   │   └── errorHandler.js   # Central error taxonomy
│   │   ├── routes/
│   │   │   ├── auth.js           # Register, login, me
│   │   │   ├── health.js         # /health (liveness) + /ready (readiness)
│   │   │   └── ...               # Workspaces, boards, tasks, comments
│   │   ├── services/
│   │   │   ├── taskService.js    # CRUD + OCC + gap ordering
│   │   │   ├── positionService.js# Midpoint positioning logic
│   │   │   └── activityService.js# Audit trail
│   │   ├── utils/
│   │   │   ├── prisma.js         # Singleton Prisma client
│   │   │   ├── redis.js          # Redis + in-memory fallback
│   │   │   ├── logger.js         # Structured JSON logging
│   │   │   ├── response.js       # Success envelope
│   │   │   ├── schemas.js        # Zod schemas (single source of truth)
│   │   │   ├── errors.js         # AppError taxonomy
│   │   │   ├── permissions.js    # RBAC matrix
│   │   │   └── events.js         # WebSocket event contract
│   │   └── socket.js             # Socket.io server + presence
│   ├── prisma/
│   │   ├── schema.prisma         # Full DB schema with indexes
│   │   └── seed.js               # Demo data
│   └── tests/
│       ├── unit/                 # Authorization, validation, position logic
│       └── integration/          # API endpoints, auth, concurrency
├── client/
│   ├── src/
│   │   ├── main.jsx              # Providers: QueryClient, Auth, Socket
│   │   ├── App.jsx               # Routes + protected routes
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # JWT, login/register/logout
│   │   │   └── SocketContext.jsx # Socket.io, presence, notifications
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx     # Workspaces list
│   │   │   └── Board.jsx         # Kanban + drag-drop + modals
│   │   ├── components/
│   │   │   ├── Layout.jsx        # Sidebar, top bar, user menu
│   │   │   └── ProtectedRoute.jsx
│   │   └── services/api.js       # Axios instance + interceptors
│   └── ...
├── docker-compose.yml            # PostgreSQL + Redis
├── .github/workflows/ci.yml      # Lint → Unit → Integration → Build
└── docs/
    ├── ARCHITECTURE.md
    ├── DATABASE.md               # Indexes + EXPLAIN ANALYZE examples
    ├── AUTH.md
    ├── REALTIME.md
    ├── CONCURRENCY.md            # OCC design
    ├── CACHING.md
    ├── SCALABILITY.md            # Path from 10K → 1M users
    ├── SECURITY.md
    └── ADR/                      # Architecture Decision Records
```

## 🔐 Authorization (RBAC)

**Never trust the client.** Every sensitive endpoint resolves the resource, checks membership, then checks the role matrix:

| Action | OWNER | ADMIN | MEMBER | VIEWER |
|--------|-------|-------|--------|--------|
| `workspace.view` | ✅ | ✅ | ✅ | ✅ |
| `workspace.update` | ✅ | ❌ | ❌ | ❌ |
| `workspace.manageMembers` | ✅ | ✅ | ❌ | ❌ |
| `board.view` | ✅ | ✅ | ✅ | ✅ |
| `board.manageColumns` | ✅ | ✅ | ✅ | ❌ |
| `task.create` | ✅ | ✅ | ✅ | ❌ |
| `task.update` | ✅ | ✅ | ✅ | ❌ |
| `task.move` | ✅ | ✅ | ✅ | ❌ |
| `task.delete` | ✅ | ✅ | ✅ | ❌ |

Implemented in `server/src/middleware/authorize.js` — reusable `authorizeWorkspace()` and `authorizeBoard()` factories.

## ⚡ Optimistic Concurrency Control

Every mutating request carries a `version` from the last read:

```sql
-- Server executes atomically:
UPDATE tasks
SET title = ?, version = version + 1
WHERE id = ? AND version = ?
```

- **0 rows updated → 409 CONFLICT** → client refetches, user reconciles
- Demonstrated in `server/src/services/taskService.js` (`updateTask`, `moveTask`)
- Client handles via TanStack Query optimistic updates + rollback on 409

## 🎯 Gap-Based Task Ordering

Positions are floats (100, 200, 300). Insert between A=100 and B=200 → midpoint 150.

- No O(N) renumbering on every drag
- When gap < 0.001 → rebalance column (100 spacing)
- See `server/src/services/positionService.js`

## 🔁 Idempotency

Client sends `Idempotency-Key: <uuid>` on POST `/tasks`:

1. First request → execute, store response keyed by `(key, userId)`
2. Retry (network timeout) → return stored response, no duplicate task

Implemented in `server/src/middleware/idempotency.js`.

## 📡 WebSocket Event Contract

**REST owns CRUD + initial load. WebSocket ONLY broadcasts mutations.**

| Server → Client | Payload |
|-----------------|---------|
| `task.created` | `{ task }` |
| `task.updated` | `{ task }` |
| `task.moved` | `{ task }` |
| `task.deleted` | `{ taskId }` |
| `presence.joined` | `{ users, user }` |
| `presence.left` | `{ users, userId }` |
| `comment.typing` | `{ userId, taskId }` |
| `notification.created` | `{ notification }` |

Rooms: `board:<boardId>` — scoped broadcasts. Documented in `server/src/utils/events.js`.

## 🧪 Testing

```bash
# Server
cd server
npm run test:unit         # Authorization, validation, position logic
npm run test:integration  # Full API flows, auth, 409 conflicts

# Client
cd client
npm run test              # Vitest (component tests)
```

## 📊 Performance (Local Measurements)

| Operation | p50 | p99 |
|-----------|-----|-----|
| `GET /boards/:id/data` (3 cols, 10 tasks) | 18ms | 35ms |
| `POST /tasks` (create + activity + socket) | 22ms | 48ms |
| `PATCH /tasks/:id` (update + version bump) | 14ms | 28ms |
| `POST /tasks/:id/move` (move + activity + socket) | 19ms | 41ms |
| WebSocket broadcast (10 clients) | 2ms | 5ms |

*Run on: PostgreSQL 17, Node 20, local machine. No Redis (in-memory fallback).*

## 🛡️ Security Checklist

- [x] Password hashing (bcrypt, 10 rounds)
- [x] JWT with short expiry (7d), no sensitive data in payload
- [x] Rate limiting (auth: 100/15min, API: 1000/15min)
- [x] CORS restricted to frontend origin
- [x] Helmet security headers
- [x] Input validation at API boundary (Zod)
- [x] SQL injection protection (Prisma parameterized queries)
- [x] XSS protection (React auto-escaping, no dangerouslySetInnerHTML)
- [x] Server-side RBAC on every mutating endpoint
- [x] Idempotency for duplicate-safe retries
- [x] Audit trail (who/what/when/where)

## 📈 Scalability Path

| Scale | Changes |
|-------|---------|
| **10K users** (current) | Single Node, PG, in-memory rate limit |
| **100K users** | Redis for rate limit + caching, PG read replicas, PG connection pooling |
| **1M users** | Horizontal Node pods + Redis adapter for Socket.io, PG sharding by workspace, CDN for static assets, dedicated search (PostgreSQL FTS → Elasticsearch) |

Detailed in `docs/SCALABILITY.md`.

## 🐳 Docker

```bash
# Start PostgreSQL + Redis
docker compose up -d

# Then run servers normally
cd server && npm run dev
cd client && npm run dev
```

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| `docs/ARCHITECTURE.md` | System overview, data flow, trade-offs |
| `docs/DATABASE.md` | Schema, indexes, `EXPLAIN ANALYZE` examples |
| `docs/AUTH.md` | JWT, refresh strategy, OAuth stub |
| `docs/REALTIME.md` | Socket.io rooms, event contract, presence |
| `docs/CONCURRENCY.md` | Optimistic concurrency design |
| `docs/CACHING.md` | Redis caching strategy + invalidation |
| `docs/SCALABILITY.md` | 10K → 100K → 1M evolution |
| `docs/SECURITY.md` | Threat model, mitigations, checklist |
| `docs/ADR/` | Architecture Decision Records |

## 🤝 Contributing

This is a portfolio project — but PRs for bug fixes or doc improvements are welcome.

## 📄 License

MIT — use freely for learning, interviews, or as a starter.

---

**Built with intention.** If you're interviewing and they ask "walk me through a hard problem you solved," this project has 5+ ready answers.