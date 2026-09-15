const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { notifyAssignees } = require('./services/notificationService');

async function test() {
  const user = await prisma.user.findFirst({ where: { email: 'demo@taskflow.dev' } });
  const task = await prisma.task.findFirst({ where: { title: 'Test notification with assignee' }, include: { assignees: true } });
  console.log('Task:', task?.title, 'assignees:', task?.assignees?.length);
  
  const actor = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const result = await notifyAssignees(prisma, {
    taskId: task.id,
    boardId: task.boardId,
    actorId: user.id,
    actorName: actor.name,
    action: 'assigned'
  });
  console.log('notifyAssignees result:', result);
  
  const notifications = await prisma.notification.findMany({ where: { userId: user.id } });
  console.log('Notifications:', notifications.length);
}

test().catch(console.error).finally(() => prisma.$disconnect());
