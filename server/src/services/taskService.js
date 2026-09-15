// ─────────────────────────────────────────────────────────────
// Task service.
//
// Responsibilities:
//   CRUD with Prisma $transaction (task + activity log are atomic)
//   Optimistic concurrency control via Task.version
//   Gap-based position ordering
//   Socket events broadcast AFTER transaction commits
//
// Concurrency model:
//   Every mutating request carries a `version` from the last read.
//   The UPDATE uses WHERE version = V; 0 rows updated → 409 Conflict.
//   The client refetches the latest task and lets the user reconcile.
//   See docs/CONCURRENCY.md.
// ─────────────────────────────────────────────────────────────

const prisma = require('../utils/prisma');
const { errors } = require('../errors');
const { nextPosition } = require('./positionService');
const activityLog = require('./activityService');
const notificationService = require('./notificationService');
const { SERVER_EVENTS, boardRoom } = require('../utils/events');
const logger = require('../utils/logger');

// ── Read ────────────────────────────────────────────────────
async function getTasks(boardId, { columnId, limit = 50, cursor } = {}) {
  const where = { boardId };
  if (columnId) where.columnId = columnId;

  if (cursor) {
    const cursorTask = await prisma.task.findUnique({ where: { id: cursor }, select: { position: true } });
    if (cursorTask) where.position = { gt: cursorTask.position };
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { position: 'asc' },
    take: limit + 1, // fetch one extra to detect if there is a next page
    include: {
      assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      labels: { select: { label: true } },
    },
  });

  const hasMore = tasks.length > limit;
  const data = hasMore ? tasks.slice(0, limit) : tasks;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { data, nextCursor, hasMore };
}

// ── Create ──────────────────────────────────────────────────
async function createTask(boardId, createdById, input) {
  const { assigneeIds, labelIds, ...taskData } = input;

  const task = await prisma.$transaction(async (tx) => {
    const columnId = taskData.columnId || await getDefaultColumn(tx, boardId);
    const position = await nextPosition(tx, columnId);

    const created = await tx.task.create({
      data: { ...taskData, columnId, position, boardId, createdById },
    });

    await activityLog.log(tx, {
      boardId,
      taskId: created.id,
      actorId: createdById,
      action: 'task.created',
      entityType: 'task',
      entityId: created.id,
      detail: `Created "${created.title}"`,
    });

    // Attach assignees + labels atomically
    if (assigneeIds?.length) {
      await tx.taskAssignment.createMany({ data: assigneeIds.map((uid) => ({ taskId: created.id, userId: uid })) });
    }
    if (labelIds?.length) {
      await tx.taskLabel.createMany({ data: labelIds.map((lid) => ({ taskId: created.id, labelId: lid })) });
    }

    // Create notifications for assignees (excluding creator)
    if (assigneeIds?.length) {
      const actor = await tx.user.findUnique({ where: { id: createdById }, select: { name: true } });
      await notificationService.notifyAssignees(tx, {
        taskId: created.id,
        boardId,
        actorId: createdById,
        actorName: actor?.name || 'Someone',
        action: 'assigned',
      });
    }

    return await tx.task.findUnique({
      where: { id: created.id },
      include: {
        assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        labels: { select: { label: true } },
      },
    });
  });

  return task;
}

// ── Update (optimistic concurrency) ─────────────────────────
async function updateTask(taskId, userId, input) {
  const { version, ...data } = input;

  const task = await prisma.$transaction(async (tx) => {
    // Atomic: update + version bump in one WHERE clause.
    const updated = await tx.task.updateMany({
      where: { id: taskId, version },
      data: { ...data, version: version + 1 },
    });

    if (updated.count === 0) throw errors.conflict(
      'Task was modified by someone else. Please refresh and try again.'
    );

    const boardId = (await tx.task.findUnique({ where: { id: taskId } })).boardId;
    await activityLog.log(tx, {
      boardId,
      taskId,
      actorId: userId,
      action: 'task.updated',
      entityType: 'task',
      entityId: taskId,
      detail: `Updated ${Object.keys(data).join(', ')}`,
    });

    // Notify assignees of update (excluding the actor)
    const actor = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notificationService.notifyAssignees(tx, {
      taskId,
      boardId,
      actorId: userId,
      actorName: actor?.name || 'Someone',
      action: 'updated',
    });

    return await tx.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        labels: { select: { label: true } },
      },
    });
  });

  return task;
}

// ── Move (column + position, with concurrency check) ────────
async function moveTask(taskId, userId, { columnId, position, beforeTaskId, version }) {
  const task = await prisma.$transaction(async (tx) => {
    const current = await tx.task.findUnique({ where: { id: taskId } });
    if (!current) throw errors.notFound('Task not found');
    if (current.version !== version) {
      throw errors.conflict('Task was modified by someone else. Please refresh and try again.');
    }

    const targetColumnId = columnId || current.columnId;
    const newPos = position ?? await nextPosition(tx, targetColumnId, beforeTaskId);

    await tx.task.update({
      where: { id: taskId, version },
      data: { columnId: targetColumnId, position: newPos, version: version + 1 },
    });

    await activityLog.log(tx, {
      boardId: current.boardId,
      taskId,
      actorId: userId,
      action: 'task.moved',
      entityType: 'task',
      entityId: taskId,
      detail: `Moved to column ${targetColumnId}`,
    });

    // Notify assignees of move (excluding the actor)
    const actor = await tx.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notificationService.notifyAssignees(tx, {
      taskId,
      boardId: current.boardId,
      actorId: userId,
      actorName: actor?.name || 'Someone',
      action: 'moved',
    });

    return await tx.task.findUnique({
      where: { id: taskId },
      include: {
        assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        labels: { select: { label: true } },
      },
    });
  });

  return task;
}

// ── Delete ──────────────────────────────────────────────────
async function deleteTask(taskId, userId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw errors.notFound('Task not found');

  await prisma.$transaction(async (tx) => {
    // Log activity BEFORE deleting task (FK constraint on activityLog.taskId)
    await activityLog.log(tx, {
      boardId: task.boardId,
      taskId,
      actorId: userId,
      action: 'task.deleted',
      entityType: 'task',
      entityId: taskId,
      detail: `Deleted "${task.title}"`,
    });
    await tx.task.delete({ where: { id: taskId } });
  });

  return task;
}

async function getDefaultColumn(tx, boardId) {
  const col = await tx.column.findFirst({ where: { boardId }, orderBy: { position: 'asc' } });
  return col?.id ?? null;
}

module.exports = { getTasks, createTask, updateTask, moveTask, deleteTask };