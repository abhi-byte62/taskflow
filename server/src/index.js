require('dotenv').config();
const http = require('http');
const { createApp, attachErrorHandling } = require('./app');
const { initSocket } = require('./socket');
const { authenticate } = require('./middleware/auth');
const { validate } = require('./middleware/validate');
const { authorizeWorkspace, authorizeBoard } = require('./middleware/authorize');
const { idempotency } = require('./middleware/idempotency');
const { SERVER_EVENTS, boardRoom } = require('./utils/events');
const { success } = require('./utils/response');
const { errors } = require('../src/errors');
const prisma = require('./utils/prisma');
const config = require('./config');
const logger = require('./utils/logger');
const taskService = require('./services/taskService');
const notificationService = require('./services/notificationService');
const notificationRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const {
  workspaceSchema,
  workspaceUpdateSchema,
  boardSchema,
  boardUpdateSchema,
  columnSchema,
  columnUpdateSchema,
  createTaskSchema,
  updateTaskSchema,
  moveTaskSchema,
  commentSchema,
  idSchema,
  cursorQuerySchema,
} = require('./utils/schemas');

const app = createApp();
const server = http.createServer(app);
const io = initSocket(server); // attach Socket.io, expose io to routes via app.locals
app.locals.io = io;

// ── Helpers ──────────────────────────────────────────────────

// Fetch a task by ID and attach to req (used by authorizeBoard's idSource
// for task routes where :id is the task ID, not a board ID).
async function loadTask(req) {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, select: { boardId: true } });
  if (!task) throw errors.notFound('Task not found');
  req.task = task;
  return task.boardId;
}

function attachEmitter(boardId) {
  // Return a helper that REST controllers use to broadcast after a
  // successful write (same frame as the HTTP response).
  return (event, data) => {
    io.to(boardRoom(boardId)).emit(event, data);
  };
}

// ── Workspace routes ─────────────────────────────────────────
const workspaces = require('express').Router();

workspaces.get('/', authenticate, async (req, res, next) => {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user.id },
      include: {
        workspace: {
          include: {
            boards: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });
    success(res, { data: memberships.map((m) => m.workspace) });
  } catch (err) { next(err); }
});

workspaces.post('/', authenticate, validate({ body: workspaceSchema }), async (req, res, next) => {
  try {
    const workspace = await prisma.workspace.create({
      data: { name: req.body.name, description: req.body.description, ownerId: req.user.id },
    });
    // Auto-add the owner as OWNER member.
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: req.user.id, role: 'OWNER' },
    });
    // Auto-create default board
    const board = await prisma.board.create({
      data: {
        name: 'Main Board',
        description: 'Default board for ' + req.body.name,
        workspaceId: workspace.id,
        ownerId: req.user.id,
      },
    });
    const defaultCols = ['To Do', 'In Progress', 'Done'];
    await prisma.column.createMany({
      data: defaultCols.map((name, i) => ({ name, boardId: board.id, position: (i + 1) * 100 })),
    });

    const fullWorkspace = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      include: {
        boards: { orderBy: { createdAt: 'asc' } },
      },
    });
    success(res, { data: fullWorkspace }, 201);
  } catch (err) { next(err); }
});

workspaces.get('/:id', authenticate, authorizeWorkspace('workspace.view'), (req, res) => {
  success(res, { data: req.workspace });
});

workspaces.patch('/:id', authenticate, authorizeWorkspace('workspace.update'), validate({ body: workspaceUpdateSchema }), async (req, res, next) => {
  try {
    const workspace = await prisma.workspace.update({ where: { id: req.params.id }, data: req.body });
    success(res, { data: workspace });
  } catch (err) { next(err); }
});

workspaces.delete('/:id', authenticate, authorizeWorkspace('workspace.delete'), async (req, res, next) => {
  try {
    await prisma.workspace.delete({ where: { id: req.params.id } });
    success(res, { data: { deleted: true } });
  } catch (err) { next(err); }
});

// ── Board routes ─────────────────────────────────────────────
const boards = require('express').Router();

boards.get('/workspace/:workspaceId', authenticate, authorizeWorkspace('workspace.view', (req) => req.params.workspaceId), async (req, res, next) => {
  try {
    const data = await prisma.board.findMany({ where: { workspaceId: req.params.workspaceId }, orderBy: { createdAt: 'desc' } });
    success(res, { data });
  } catch (err) { next(err); }
});

boards.post('/workspace/:workspaceId', authenticate, authorizeWorkspace('workspace.createBoard', (req) => req.params.workspaceId), validate({ body: boardSchema }), async (req, res, next) => {
  try {
    const board = await prisma.board.create({
      data: { name: req.body.name, description: req.body.description, icon: req.body.icon, workspaceId: req.params.workspaceId, ownerId: req.user.id },
    });
    // Default columns
    const defaultCols = ['To Do', 'In Progress', 'Done'];
    await prisma.column.createMany({ data: defaultCols.map((name, i) => ({ name, boardId: board.id, position: i * 100 })) });
    success(res, { data: board }, 201);
  } catch (err) { next(err); }
});

// Board data load — MUST be before /:id to avoid Express greedy match
boards.get('/:id/data', authenticate, authorizeBoard('board.view'), async (req, res, next) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        columns: {
          orderBy: { position: 'asc' },
          include: {
            tasks: {
              orderBy: { position: 'asc' },
              include: {
                assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
                labels: { select: { label: true } },
              },
            },
          },
        },
        labels: true,
      },
    });
    success(res, { data: board });
  } catch (err) { next(err); }
});

boards.get('/:id', authenticate, authorizeBoard('board.view'), (req, res) => {
  success(res, { data: req.board });
});

boards.patch('/:id', authenticate, authorizeBoard('board.update'), validate({ body: boardUpdateSchema }), async (req, res, next) => {
  try {
    const board = await prisma.board.update({ where: { id: req.params.id }, data: req.body });
    success(res, { data: board });
  } catch (err) { next(err); }
});

boards.delete('/:id', authenticate, authorizeBoard('board.delete'), async (req, res, next) => {
  try {
    await prisma.board.delete({ where: { id: req.params.id } });
    success(res, { data: { deleted: true } });
  } catch (err) { next(err); }
});

// ── Column routes ────────────────────────────────────────────
const columns = require('express').Router();

// Helper to load column and its board for authorization
async function loadColumnContext(columnId, userId) {
  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: { board: { include: { members: { where: { userId } }, workspace: { include: { members: { where: { userId } } } } } } },
  });
  if (!column) throw errors.notFound('Column not found');
  return column;
}

columns.post('/board/:boardId', authenticate, authorizeBoard('board.manageColumns', (req) => req.params.boardId), validate({ body: columnSchema }), async (req, res, next) => {
  try {
    const maxPos = await prisma.column.aggregate({ where: { boardId: req.params.boardId }, _max: { position: true } });
    const col = await prisma.column.create({
      data: { name: req.body.name, boardId: req.params.boardId, position: (maxPos._max.position ?? -100) + 100 },
    });
    success(res, { data: col }, 201);
  } catch (err) { next(err); }
});

columns.patch('/:id', authenticate, authorizeBoard('board.manageColumns', async (req) => {
  const column = await loadColumnContext(req.params.id, req.user.id);
  req.column = column;
  return column.boardId;
}), validate({ body: columnUpdateSchema }), async (req, res, next) => {
  try {
    const col = await prisma.column.update({ where: { id: req.params.id }, data: { name: req.body.name, position: req.body.position } });
    success(res, { data: col });
  } catch (err) { next(err); }
});

columns.delete('/:id', authenticate, authorizeBoard('board.manageColumns', async (req) => {
  const column = await loadColumnContext(req.params.id, req.user.id);
  req.column = column;
  return column.boardId;
}), async (req, res, next) => {
  try {
    await prisma.column.delete({ where: { id: req.params.id } });
    success(res, { data: { deleted: true } });
  } catch (err) { next(err); }
});

// ── Task routes ──────────────────────────────────────────────
const tasks = require('express').Router();

tasks.get('/board/:boardId', authenticate, authorizeBoard('board.view', (req) => req.params.boardId), validate({ query: cursorQuerySchema }), async (req, res, next) => {
  try {
    const data = await taskService.getTasks(req.params.boardId, {
      columnId: req.query.columnId,
      limit: req.query.limit,
      cursor: req.query.cursor,
    });
    success(res, data);
  } catch (err) { next(err); }
});

tasks.post('/board/:boardId', authenticate, authorizeBoard('task.create', (req) => req.params.boardId), validate({ body: createTaskSchema }), idempotency, async (req, res, next) => {
  try {
    const task = await taskService.createTask(req.params.boardId, req.user.id, req.body);
    attachEmitter(req.params.boardId)(SERVER_EVENTS.TASK_CREATED, { task });
    success(res, { data: task }, 201);
  } catch (err) { next(err); }
});

tasks.patch('/:id', authenticate, authorizeBoard('task.update', loadTask), validate({ body: updateTaskSchema }), async (req, res, next) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.user.id, req.body);
    attachEmitter(task.boardId)(SERVER_EVENTS.TASK_UPDATED, { task });
    success(res, { data: task });
  } catch (err) { next(err); }
});

tasks.post('/:id/move', authenticate, authorizeBoard('task.move', loadTask), validate({ body: moveTaskSchema }), async (req, res, next) => {
  try {
    const task = await taskService.moveTask(req.params.id, req.user.id, req.body);
    attachEmitter(task.boardId)(SERVER_EVENTS.TASK_MOVED, { task });
    success(res, { data: task });
  } catch (err) { next(err); }
});

tasks.delete('/:id', authenticate, authorizeBoard('task.delete', loadTask), async (req, res, next) => {
  try {
    const task = await taskService.deleteTask(req.params.id, req.user.id);
    attachEmitter(task.boardId)(SERVER_EVENTS.TASK_DELETED, { taskId: task.id });
    success(res, { data: { deleted: true } });
  } catch (err) { next(err); }
});

// ── Comment routes ───────────────────────────────────────────
const comments = require('express').Router();

comments.get('/task/:taskId', authenticate, async (req, res, next) => {
  try {
    const data = await prisma.comment.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    success(res, { data });
  } catch (err) { next(err); }
});

comments.post('/task/:taskId', authenticate, authorizeBoard('task.comment', async (req) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId }, select: { boardId: true } });
  return task?.boardId;
}), validate({ body: commentSchema }), async (req, res, next) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
    const comment = await prisma.comment.create({
      data: { content: req.body.content, taskId: req.params.taskId, authorId: req.user.id },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    // Emit to board room
    if (task) attachEmitter(task.boardId)(SERVER_EVENTS.COMMENT_CREATED, { comment });

    // Create notifications for mentions and assignees
    if (task) {
      const actor = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
      await notificationService.notifyAssignees(prisma, {
        taskId: task.id,
        boardId: task.boardId,
        actorId: req.user.id,
        actorName: actor?.name || 'Someone',
        action: 'commented',
      });
      await notificationService.notifyMentions(prisma, {
        content: req.body.content,
        boardId: task.boardId,
        taskId: task.id,
        actorId: req.user.id,
      });
    }

    success(res, { data: comment }, 201);
  } catch (err) { next(err); }
});

// ── Mount all business routes ────────────────────────────────
app.use('/api/workspaces', workspaces);
app.use('/api/boards', boards);
app.use('/api/columns', columns);
app.use('/api/tasks', tasks);
app.use('/api/comments', comments);
app.use('/api/notifications', notificationRoutes);
app.use('/api/activity', activityRoutes);

// Error handling must be attached AFTER all routes.
attachErrorHandling(app);

const PORT = config.port;
server.listen(PORT, () => {
  logger.info('server_started', { port: PORT, env: config.env });
  console.log(`✅ TaskFlow API running on http://localhost:${PORT}`);
});