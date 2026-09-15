# Real-Time Architecture

## Design Principle

**REST owns mutations. WebSocket owns broadcasts.**

The database is the source of truth. Socket events are projections of committed transactions.

## Event Contract (Single Source of Truth)

Defined in `server/src/utils/events.js`:

```javascript
const CLIENT_EVENTS = {
  BOARD_JOIN: 'board:join',
  BOARD_LEAVE: 'board:leave',
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  COMMENT_TYPING: 'comment:typing',
};

const SERVER_EVENTS = {
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_MOVED: 'task.moved',
  TASK_DELETED: 'task.deleted',
  COLUMN_CREATED: 'column.created',
  COLUMN_UPDATED: 'column.updated',
  COLUMN_DELETED: 'column.deleted',
  COMMENT_CREATED: 'comment.created',
  PRESENCE_JOINED: 'presence.joined',
  PRESENCE_LEFT: 'presence.left',
  COMMENT_TYPING: 'comment.typing',
  NOTIFICATION: 'notification.created',
};
```

## Room Architecture

```
Workspace
   │
   ├── Board A (room: "board:abc")
   │     ├── User 1 (socket)
   │     ├── User 2 (socket)
   │     └── User 3 (socket)
   │
   └── Board B (room: "board:def")
         ├── User 4
         └── User 5
```

- Room name: `board:<boardId>`
- Client joins exactly one board room at a time
- Presence tracked per-board via in-memory `Map<boardId, Map<userId, Set<socketId>>>`

## Connection Flow

```
Client                          Server
  │                                │
  │──── io.connect({auth:{token}})──►│
  │                                │ 1. JWT verify (middleware)
  │                                │ 2. socket.userId = decoded.userId
  │◄─── connected ─────────────────│
  │                                │
  │──── board:join("board:abc") ───►│
  │                                │ 1. socket.join("board:abc")
  │                                │ 2. Track presence
  │◄─── presence.joined {users} ───│ 3. Broadcast to room
  │                                │
  │──── task.moved (REST) ─────────►│
  │                                │ 1. Validate, authorize, transact
  │                                │ 2. Commit to PostgreSQL
  │                                │ 3. io.to("board:abc").emit("task.moved", {task})
  │◄─── task.moved {task} ─────────│ 4. Broadcast to room
  │                                │
  │──── board:leave ───────────────►│
  │                                │ 1. socket.leave("board:abc")
  │                                │ 2. Remove presence
  │◄─── presence.left {users} ─────│ 3. Broadcast to room
```

## Presence System

```javascript
// Server: in-memory Map
const presence = new Map(); // boardId → Map<userId, Set<socketId>>

io.on('connection', (socket) => {
  socket.on('board:join', (boardId) => {
    socket.join(`board:${boardId}`);
    // Track: presence.set(boardId, Map<userId, Set<socketId>>)
    io.to(`board:${boardId}`).emit('presence.joined', {
      users: getUsersOnBoard(boardId),  // Array of {id, name, avatarUrl}
      user: joinedUser,
    });
  });

  socket.on('disconnect', () => {
    // Clean up presence, emit presence.left
  });
});
```

**Why in-memory?** Presence is ephemeral. If server restarts, clients reconnect and re-join. For multi-instance deployments, see SCALABILITY.md (Redis adapter).

## Typing Indicators

```
User A types in comment on Task #123
    │
    ▼
Client: socket.emit('comment:typing', { boardId, taskId })
    │
    ▼
Server: socket.to(`board:${boardId}`).emit('comment:typing', {
  userId: socket.userId,
  taskId,
})
    │
    ▼
Other clients in same board room show "User A is typing..."
    │
    ▼
Auto-clear after 3s of no keystrokes (client-side timeout)
```

## Notification System

Real-time notifications via Socket.io + persisted in PostgreSQL:

| Event | Socket Event | Persisted? |
|-------|--------------|------------|
| Task created | `task.created` | No (board already has it) |
| Task assigned to you | `notification.created` | Yes (Notification table) |
| Comment on your task | `notification.created` | Yes |
| @mention in comment | `notification.created` | Yes |
| Due date reminder | `notification.created` | Yes (cron) |

**Deduplication:** Client tracks `notification.id` to avoid double-show.

## Scaling WebSocket

### Single Instance (Current)
- In-memory presence + direct `io.to(room).emit()`

### Multiple Instances (Future)
```
                    ┌─────────────┐
                    │  Load       │
                    │  Balancer   │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ Node A   │     │ Node B   │     │ Node C   │
    │ (Socket) │     │ (Socket) │     │ (Socket) │
    └────┬─────┘     └────┬─────┘     └────┬─────┘
         │                │                │
         └────────────────┼────────────────┘
                          ▼
                   ┌─────────────┐
                   │   Redis     │
                   │  Pub/Sub    │
                   │ (Adapter)   │
                   └─────────────┘
```

**Implementation:** `socket.io-redis` adapter — `io.adapter(createAdapter(redisClient))`. Presence sync across instances via Redis.

## Client-Side Hook

```javascript
// src/context/SocketContext.jsx
export function useSocket() {
  const { joinBoard, leaveBoard, onlineUsers, notifications, sendTyping } = useContext(SocketContext);
  
  return { joinBoard, leaveBoard, onlineUsers, notifications, sendTyping };
}
```

**Usage in Board page:**
```javascript
useEffect(() => {
  joinBoard(boardId);
  return () => leaveBoard();
}, [boardId, joinBoard, leaveBoard]);
```

## Why Not Server-Sent Events (SSE)?

| Feature | WebSocket | SSE |
|---------|-----------|-----|
| Bidirectional | ✅ | ❌ (client→server needs separate HTTP) |
| Binary | ✅ | ❌ |
| Auto-reconnect | Built-in | Manual |
| Browser support | Universal | Universal |
| Load balancer friendly | Needs sticky sessions | ✅ Native |

**Decision:** WebSocket. Bidirectional needed for `board:join/leave`, typing, presence. Socket.io handles reconnection + fallbacks.

## Security

- JWT verified in Socket.io middleware (`socket.handshake.auth.token`)
- Room joins authorized via same RBAC as REST
- No sensitive data in socket events (only IDs + minimal payload)
- Rate limiting on connection attempts (via Express rate limiter on `/socket.io/`)