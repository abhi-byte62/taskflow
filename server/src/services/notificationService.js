// Notification service
// Creates in-app notifications for mentions, assignments, comments, due dates

const prisma = require('../utils/prisma');

async function notify(prisma, { userId, type, message, boardId, taskId }) {
  if (!userId) return null;
  return prisma.notification.create({
    data: { userId, type, message, boardId, taskId },
  });
}

async function notifyAssignees(prisma, { taskId, boardId, actorId, actorName, action }) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } },
  });
  if (!task?.assignees?.length) return [];

  const assigneeIds = task.assignees.map(a => a.userId).filter(id => id !== actorId);
  if (!assigneeIds.length) return [];

  const messages = {
    assigned: `${actorName} assigned you to "${task.title}"`,
    updated: `${actorName} updated "${task.title}"`,
    commented: `${actorName} commented on "${task.title}"`,
    moved: `${actorName} moved "${task.title}"`,
  };

  return prisma.notification.createMany({
    data: assigneeIds.map(userId => ({
      userId,
      type: action,
      message: messages[action] || `${actorName} ${action} "${task.title}"`,
      boardId,
      taskId,
    })),
  });
}

async function notifyMentions(prisma, { content, boardId, taskId, actorId }) {
  const mentionRegex = /@(\w+)/g;
  const mentions = content.match(mentionRegex);
  if (!mentions) return [];

  const usernames = mentions.map(m => m.slice(1));
  const users = await prisma.user.findMany({
    where: { name: { in: usernames } },
    select: { id: true, name: true },
  });

  return prisma.notification.createMany({
    data: users
      .filter(u => u.id !== actorId)
      .map(user => ({
        userId: user.id,
        type: 'mention',
        message: `You were mentioned in "${taskId ? 'a task' : 'a comment'}"`,
        boardId,
        taskId,
      })),
  });
}

module.exports = { notify, notifyAssignees, notifyMentions };