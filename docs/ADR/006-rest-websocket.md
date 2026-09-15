# ADR-006: Why REST + WebSocket Separation?

## Status
Accepted

## Context
Need both CRUD operations and real-time updates. Could use GraphQL subscriptions, pure WebSocket, or REST + WebSocket.

## Decision
**REST for mutations + initial loads. WebSocket ONLY for live broadcasts.**

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **REST + WebSocket** | Clear separation, standard, cacheable, debuggable | Two protocols |
| GraphQL + Subscriptions | Single endpoint, typed | Overkill, complex caching, N+1 risk |
| Pure WebSocket | Single connection | No HTTP semantics, hard to debug, no caching |
| SSE + REST | Simple, HTTP-native | Unidirectional, need separate HTTP for mutations |

## Consequences

**Positive:**
- REST: standard, cacheable, explicit, interview-friendly
- WebSocket: only does what REST can't (push)
- Database remains single source of truth
- Clear mental model: "REST changes state, WebSocket notifies"

**Negative:**
- Two connection types to manage
- Client needs both HTTP client and Socket.io

## Implementation Rules

### REST Owns:
- `POST /tasks` — Create
- `GET /boards/:id/data` — Initial load
- `PATCH /tasks/:id` — Update
- `POST /tasks/:id/move` — Move (drag-drop)
- `DELETE /tasks/:id` — Delete
- `POST /comments` — Comment

### WebSocket Owns:
- `task.created` — Broadcast after REST create
- `task.updated` — Broadcast after REST update
- `task.moved` — Broadcast after REST move
- `task.deleted` — Broadcast after REST delete
- `presence.joined/left` — Ephemeral
- `comment.typing` — Ephemeral
- `notification.created` — Real-time alert

### Anti-Patterns (Forbidden):
- ❌ WebSocket mutation: `socket.emit('task:create', { title: 'X' })`
- ❌ WebSocket state: storing task list in socket memory
- ❌ REST polling for live updates: `setInterval(fetchBoard, 1000)`

## Server Flow (Mutation)

```
POST /tasks
    │
    ▼
Rate Limit → Auth → Authorize → Validate → Idempotency
    │
    ▼
Controller → Service
    │
    ▼
Prisma $transaction
    ├── Task CREATE
    ├── ActivityLog CREATE
    └── (Assignees/Labels)
    │
    ▼
io.to(`board:${boardId}`).emit(SERVER_EVENTS.TASK_CREATED, { task })
    │
    ▼
HTTP 201 + Task JSON
```

## Client Flow

```javascript
// 1. REST mutation (optimistic)
const createTask = useMutation({
  mutationFn: (data) => api.post(`/tasks/board/${boardId}`, data),
  onMutate: async (data) => {
    // Optimistic update
    queryClient.setQueryData(['board', boardId], (old) => ({
      ...old,
      columns: old.columns.map(col => 
        col.id === data.columnId
          ? { ...col, tasks: [fakeTask(data), ...col.tasks] }
          : col
      ),
    }));
  },
  onError: () => queryClient.invalidateQueries({ queryKey: ['board', boardId] }),
});

// 2. WebSocket receives server's version
useEffect(() => {
  socket.on('task.created', ({ task }) => {
    queryClient.setQueryData(['board', boardId], (old) => ({
      ...old,
      columns: old.columns.map(col => 
        col.id === task.columnId
          ? { ...col, tasks: col.tasks.map(t => t.id === fakeId ? task : t) }
          : col
      ),
    }));
  });
}, [socket, boardId]);
```

## References
- `server/src/utils/events.js`
- `server/src/socket.js`
- `server/src/index.js` (REST routes)
- `docs/REALTIME.md`