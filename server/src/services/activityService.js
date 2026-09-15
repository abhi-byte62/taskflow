// Activity / audit trail service.
// Every mutation goes through here so we can answer:
// "Who deleted this task?" "When did this label change?"

const prisma = require('../utils/prisma');

/**
 * Append an audit log entry.
 * Called inside the same transaction as the mutation so both succeed or fail.
 */
async function log(prisma, { boardId, taskId, actorId, action, entityType, entityId, detail }) {
  return prisma.activityLog.create({
    data: { boardId, taskId, actorId, action, entityType, entityId, detail },
  });
}

module.exports = { log };