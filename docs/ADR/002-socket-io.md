# ADR-002: Why Socket.io over raw WebSockets / SSE?

## Status
Accepted

## Context
Need real-time features: live task updates, presence, typing indicators, notifications.

## Decision
Use **Socket.io** (v4) for WebSocket communication.

## Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Socket.io** | Auto-reconnect, rooms, fallbacks (polling), binary, battle-tested | Extra dependency, custom protocol |
| Raw WebSocket (ws) | Minimal, standard | Manual reconnect, no rooms, no fallback |
| Server-Sent Events | Simple, HTTP/2 friendly, auto-reconnect | Unidirectional (need separate HTTP for client→server) |
| GraphQL Subscriptions | Integrated with GraphQL | Overkill, requires GraphQL server |

## Consequences

**Positive:**
- Rooms map perfectly to board-scoped broadcasts
- Presence tracking built on `socket.join/leave`
- Auto-reconnect with exponential backoff
- Polling fallback for restrictive networks
- Binary support if needed later
- Battle-tested at scale (Socket.io used by Microsoft, Trello, etc.)

**Negative:**
- Custom protocol (not standard WebSocket)
- Slightly larger client bundle (~15KB gzipped)
- Sticky sessions needed for multi-instance (solved by Redis adapter)

## Mitigations
- Documented event contract in `server/src/utils/events.js`
- Redis adapter for horizontal scaling (`docs/SCALABILITY.md`)
- Client hook abstracts Socket.io (`useSocket` in `SocketContext.jsx`)

## References
- `server/src/socket.js`
- `server/src/utils/events.js`
- `docs/REALTIME.md`