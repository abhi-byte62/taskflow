// ─────────────────────────────────────────────────────────────
// WebSocket event contract — the single source of truth for the
// realtime layer. Documented in docs/REALTIME.md.
//
// RULE: REST owns Create/Read/Update/Delete + initial data load.
//       WebSocket ONLY broadcasts mutations that already happened.
//       The database is the source of truth; socket events are projections.
// ─────────────────────────────────────────────────────────────

// Client → server (command/control; these do NOT persist state).
const CLIENT_EVENTS = {
  BOARD_JOIN: 'board:join',
  BOARD_LEAVE: 'board:leave',
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  COMMENT_TYPING: 'comment:typing',
};

// Server → client (broadcasts after a REST mutation succeeded).
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

// Room naming convention — "board:«boardId»" scopes broadcasts to the board.
function boardRoom(boardId) {
  return `board:${boardId}`;
}

function presenceRoom(boardId) {
  return `presence:${boardId}`;
}

module.exports = { CLIENT_EVENTS, SERVER_EVENTS, boardRoom, presenceRoom };