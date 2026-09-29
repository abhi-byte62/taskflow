const express = require('express');
const { authenticate } = require('../middleware/auth');
const { authorizeBoard } = require('../middleware/authorize');
const prisma = require('../utils/prisma');
const { success } = require('../utils/response');

const router = express.Router();

router.get('/board/:boardId', authenticate, authorizeBoard('board.view', (req) => req.params.boardId), async (req, res, next) => {
  try {
    const { limit = 50, cursor } = req.query;
    const where = { boardId: req.params.boardId };
    if (cursor) {
      const cursorItem = await prisma.activityLog.findUnique({ where: { id: cursor }, select: { createdAt: true } });
      if (cursorItem) where.createdAt = { lt: cursorItem.createdAt };
    }
    const activities = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(limit) + 1,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const hasMore = activities.length > Number(limit);
    const data = hasMore ? activities.slice(0, Number(limit)) : activities;
    success(res, { data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (err) { next(err); }
});

router.get('/task/:taskId', authenticate, async (req, res, next) => {
  try {
    const activities = await prisma.activityLog.findMany({
      where: { taskId: req.params.taskId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
    });
    success(res, { data: activities });
  } catch (err) { next(err); }
});

module.exports = router;