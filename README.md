# TaskFlow — Collaborative Task Manager

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com)
[![Tests](https://img.shields.io/badge/tests-5%20passing-blue)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A production-grade, FAANG-level collaborative task management application with real-time Kanban boards, built with modern full-stack technologies.

## 🚀 Live Demo

**Backend:** `http://localhost:5000`  
**Frontend:** `http://localhost:5173` (or next available port)

**Login:** `demo@taskflow.dev` / `password123`

---

## ✨ Features

### Core Functionality

- **Kanban Boards** — Drag-and-drop tasks between columns with @dnd-kit
- **Real-time Collaboration** — Socket.io presence, live updates, typing indicators
- **Workspaces & Boards** — Hierarchical organization with auto-board creation
- **Task Management** — Full CRUD, priorities, due dates, assignees, labels, comments

### Engineering Excellence

- **Optimistic Concurrency Control** — Version field on every task, 409 Conflict on stale writes
- **Gap-based Positioning** — Float positions with automatic column rebalance when gaps < 0.001
- **Server-side RBAC** — OWNER > ADMIN > MEMBER > VIEWER enforced on every mutating endpoint
- **Idempotency Keys** — `Idempotency-Key` header prevents duplicate task creation on retries
- **Atomic Transactions** — Prisma `$transaction` for task + activity log writes

### Observability & Reliability

- **Health Checks** — `/api/health` (liveness) + `/api/ready` (readiness with DB/Redis)
- **Rate Limiting** — Auth endpoints (strict) + API endpoints (standard) with Redis fallback
- **Structured Logging** — Request IDs, JSON logs, error taxonomy
- **Unit Tests** — Vitest with positionService coverage (5/5 passing)

### UX & Accessibility

- **Dark Mode** — Toggle in top bar, persists to localStorage, `darkMode: 'class'` in Tailwind
- **Keyboard Accessible** — Full @dnd-kit keyboard support
- **Responsive Design** — Mobile sidebar, horizontal scroll on boards
- **Notifications** — Real-time + REST, mark-as-read, mark-all-read

---

## 🏗 Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │   Database      │
│   React 18      │◄───►│   Node/Express  │◄───►│   PostgreSQL 17 │
│   Vite + TS     │     │   Prisma ORM    │     │   (Postgres)    │
│   TanStack Query│     │   Socket.io     │     │   Redis (opt)   │
│   Tailwind CSS  │     │   Zod + JWT     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Key Design Decisions (ADRs)

| ADR | Topic                          |
| --- | ------------------------------ |
| 001 | PostgreSQL as primary database |
| 002 | Socket.io for real-time        |
| 003 | Optimistic updates with OCC    |
| 004 | Cursor-based pagination        |
| 005 | Redis for caching/rate-limit   |
| 006 | REST + WebSocket separation    |

---

## 🛠 Tech Stack

| Layer           | Technology                                                                               |
| --------------- | ---------------------------------------------------------------------------------------- |
| **Frontend**    | React 18, Vite, TanStack Query v5, React Router v6, @dnd-kit, Tailwind CSS, Lucide React |
| **Backend**     | Node.js, Express, Prisma ORM, Socket.io, Zod, bcryptjs, jsonwebtoken                     |
| **Database**    | PostgreSQL 17, Prisma Migrations                                                         |
| **Cache/Queue** | Redis (ioredis) with in-memory fallback                                                  |
| **Auth**        | JWT (HS256), bcrypt, HttpOnly-ready                                                      |
| **Testing**     | Vitest, Supertest                                                                        |
| **CI/CD**       | GitHub Actions, Docker Compose                                                           |

---

## 📦 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 17
- Redis (optional — in-memory fallback used if unavailable)

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/taskflow.git
cd taskflow

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2. Configure Environment

```bash
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL, JWT_SECRET, REDIS_URL
```

### 3. Database Setup

```bash
cd server
npx prisma migrate dev --name init
npm run seed
```

### 4. Run Development

```bash
# Terminal 1 — Backend
cd server
npm run dev          # → http://localhost:5000

# Terminal 2 — Frontend
cd client
npm run dev          # → http://localhost:5173
```

### 5. Login

```
Email:    demo@taskflow.dev
Password: password123
```

---

## 🐳 Docker (Production)

```bash
docker-compose up -d
# Services: postgres, redis, server (5000), client (5173)
```

### Environment Variables

| Variable       | Description                  | Default               |
| -------------- | ---------------------------- | --------------------- |
| `DATABASE_URL` | PostgreSQL connection string | Required              |
| `JWT_SECRET`   | 64+ char secret for JWT      | Required              |
| `REDIS_URL`    | Redis connection string      | Optional              |
| `PORT`         | Backend port                 | 5000                  |
| `CLIENT_URL`   | Frontend origin for CORS     | http://localhost:5173 |
| `NODE_ENV`     | Environment                  | development           |

---

## 📚 API Reference

### Authentication

| Method | Endpoint             | Description        |
| ------ | -------------------- | ------------------ |
| POST   | `/api/auth/register` | Register new user  |
| POST   | `/api/auth/login`    | Login, returns JWT |
| GET    | `/api/auth/me`       | Get current user   |
| POST   | `/api/auth/logout`   | Logout (stateless) |

### Workspaces

| Method | Endpoint              | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/api/workspaces`     | List user's workspaces (with boards) |
| POST   | `/api/workspaces`     | Create workspace + default board     |
| GET    | `/api/workspaces/:id` | Get workspace                        |
| PATCH  | `/api/workspaces/:id` | Update workspace                     |
| DELETE | `/api/workspaces/:id` | Delete workspace                     |

### Boards

| Method | Endpoint                    | Description                             |
| ------ | --------------------------- | --------------------------------------- |
| GET    | `/api/boards/workspace/:id` | List boards in workspace                |
| POST   | `/api/boards/workspace/:id` | Create board + default columns          |
| GET    | `/api/boards/:id`           | Get board                               |
| GET    | `/api/boards/:id/data`      | **Full board** (columns + nested tasks) |
| PATCH  | `/api/boards/:id`           | Update board                            |
| DELETE | `/api/boards/:id`           | Delete board                            |

### Columns

| Method | Endpoint                 | Description                    |
| ------ | ------------------------ | ------------------------------ |
| POST   | `/api/columns/board/:id` | Create column                  |
| PATCH  | `/api/columns/:id`       | Update column (name, position) |
| DELETE | `/api/columns/:id`       | Delete column                  |

### Tasks

| Method | Endpoint               | Description                      |
| ------ | ---------------------- | -------------------------------- |
| GET    | `/api/tasks/board/:id` | Paginated tasks (cursor-based)   |
| POST   | `/api/tasks/board/:id` | Create task (idempotent)         |
| PATCH  | `/api/tasks/:id`       | Update task (requires `version`) |
| POST   | `/api/tasks/:id/move`  | Move task (column + position)    |
| DELETE | `/api/tasks/:id`       | Delete task                      |

### Comments

| Method | Endpoint                 | Description           |
| ------ | ------------------------ | --------------------- |
| GET    | `/api/comments/task/:id` | Get comments for task |
| POST   | `/api/comments/task/:id` | Add comment           |

### Notifications

| Method | Endpoint                      | Description             |
| ------ | ----------------------------- | ----------------------- |
| GET    | `/api/notifications`          | List user notifications |
| PATCH  | `/api/notifications/:id/read` | Mark as read            |
| POST   | `/api/notifications/read-all` | Mark all as read        |

### Health

| Method | Endpoint            | Description                  |
| ------ | ------------------- | ---------------------------- |
| GET    | `/api/health`       | Liveness probe               |
| GET    | `/api/health/ready` | Readiness probe (DB + Redis) |

---

## 🔒 Security

- **JWT Authentication** — HS256, 7-day expiry, stateless
- **Password Hashing** — bcrypt (cost 10)
- **RBAC** — Server-side on every mutating endpoint
- **Rate Limiting** — Auth: 5 req/min, API: 100 req/min
- **Helmet** — Security headers (CSP, HSTS, etc.)
- **CORS** — Configured for frontend origin only
- **Input Validation** — Zod schemas on all endpoints

---

## 🧪 Testing

```bash
cd server
npm test              # Run all tests (Vitest)
npm run test:watch    # Watch mode
```

### Test Coverage

- **positionService** — 5/5 tests passing (gap-based ordering, rebalance)
- Integration tests for auth, workspaces, tasks (configured)

---

## 📁 Project Structure

```
taskflow/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Layout, ProtectedRoute
│   │   ├── context/        # AuthContext, SocketContext
│   │   ├── pages/          # Login, Register, Dashboard, Board, Workspaces
│   │   ├── services/       # API client (axios)
│   │   └── main.jsx        # Entry point
│   └── ...
├── server/                 # Node/Express backend
│   ├── src/
│   │   ├── middleware/     # auth, authorize, validate, rateLimiter, idempotency
│   │   ├── routes/         # auth, workspaces, boards, tasks, comments, notifications, activity, health
│   │   ├── services/       # taskService, positionService, notificationService, activityService
│   │   ├── utils/          # prisma, redis, logger, events, schemas, permissions, response
│   │   ├── middleware/     # errorHandler, requestId, requestLogger
│   │   ├── app.js          # Express app factory
│   │   ├── index.js        # Entry point (routes + socket)
│   │   └── config.js       # Centralized config
│   ├── prisma/             # Schema + migrations + seed
│   └── tests/              # Vitest unit tests
├── docs/                   # Architecture + ADRs
│   ├── ADR/                # 6 Architecture Decision Records
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── CONCURRENCY.md
│   ├── REALTIME.md
│   ├── SCALABILITY.md
│   ├── SECURITY.md
│   ├── AUTH.md
│   └── CACHING.md
└── docker-compose.yml      # Postgres + Redis + App
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built with ❤️ using modern full-stack best practices. Inspired by Linear, Notion, and GitHub Projects.
