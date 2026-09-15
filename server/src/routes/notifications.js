const express = require('express');
const { authenticate } = require('../middleware/auth');
const prisma = require('../utils/prisma');
const { success } = require('../utils/response');

const router = express.Router();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    success(res, { data: notifications });
  } catch (err) { next(err); }
});

router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { read: true },
    });
    success(res, { data: notification });
  } catch (err) { next(err); }
});

router.post('/read-all', authenticate, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
    success(res, { data: { markedAllRead: true } });
  } catch (err) { next(err); }
});

module.exports = router;