// ─────────────────────────────────────────────────────────────
// Socket.io server — the real-time layer.
//
// Event contract: see utils/events.js (single source of truth).
//
// RULES:
//   1. A client must authenticate via the JWT in handshake.auth.token
//      before any event is accepted.
//   2. A client joins exactly one board room at a time via board:join.
//   3. All state lives in PostgreSQL — this layer only broadcasts what
//      already happened.  No state mutation happens over a socket event.
//
// Architecture note: when scaling to multiple Node processes (PM2,
// Kubernetes pods), a Redis adapter is required to fan out board events
// across instances.  That's a future path documented in docs/SCALABILITY.md.
// ─────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const config = require('./config');
const prisma = require('./utils/prisma');
const { SERVER_EVENTS, boardRoom, presenceRoom } = require('./utils/events');
const logger = require('./utils/logger');

// In-memory presence tracker per board.
// Maps: boardId → Map<userId, Set<socketId>>
const presence = new Map();

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: config.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // ── Auth middleware ──────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    logger.info('socket.connected', { userId: socket.userId, socketId: socket.id });

    // ── Room management ────────────────────────────────────
    socket.on('board:join', async (boardId) => {
      socket.join(boardRoom(boardId));
      socket.currentBoardId = boardId;

      // Track presence.
      if (!presence.has(boardId)) presence.set(boardId, new Map());
      const boardPresence = presence.get(boardId);
      if (!boardPresence.has(socket.userId)) boardPresence.set(socket.userId, new Set());
      boardPresence.get(socket.userId).add(socket.id);

      // Broadcast who's online.
      const user = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { id: true, name: true, avatarUrl: true },
      });
      io.to(boardRoom(boardId)).emit(SERVER_EVENTS.PRESENCE_JOINED, {
        users: getUsersOnBoard(boardId),
        user,
      });
      logger.info('board.joined', { userId: socket.userId, boardId });
    });

    socket.on('board:leave', (boardId) => {
      socket.leave(boardRoom(boardId));
      removePresence(boardId, socket.userId, socket.id);
      io.to(boardRoom(boardId)).emit(SERVER_EVENTS.PRESENCE_LEFT, {
        users: getUsersOnBoard(boardId),
        userId: socket.userId,
      });
      socket.currentBoardId = null;
    });

    socket.on('comment:typing', ({ boardId, taskId }) => {
      socket.to(boardRoom(boardId)).emit(SERVER_EVENTS.COMMENT_TYPING, {
        userId: socket.userId,
        taskId,
      });
    });

    socket.on('disconnect', () => {
      if (socket.currentBoardId) {
        removePresence(socket.currentBoardId, socket.userId, socket.id);
        io.to(boardRoom(socket.currentBoardId)).emit(SERVER_EVENTS.PRESENCE_LEFT, {
          users: getUsersOnBoard(socket.currentBoardId),
          userId: socket.userId,
        });
      }
      logger.info('socket.disconnected', { userId: socket.userId, socketId: socket.id });
    });
  });

  return io;
}

// ── Presence helpers ────────────────────────────────────────
function removePresence(boardId, userId, socketId) {
  const boardPresence = presence.get(boardId);
  if (!boardPresence) return;
  const sockets = boardPresence.get(userId);
  if (sockets) sockets.delete(socketId);
  if (sockets?.size === 0) boardPresence.delete(userId);
  if (boardPresence.size === 0) presence.delete(boardId);
}

function getUsersOnBoard(boardId) {
  const boardPresence = presence.get(boardId);
  if (!boardPresence) return [];
  return Array.from(boardPresence.keys());
}

module.exports = { initSocket };