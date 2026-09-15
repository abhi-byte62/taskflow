// ─────────────────────────────────────────────────────────────
// Gap-based task ordering.
//
// Positions are floats (100, 200, 300…). Inserting between two tasks
// means taking the midpoint: (100 + 200) / 2 = 150.
//
// This avoids the O(N) renumbering that simple integer ordering would need
// after every drag.  When positions get too close together (midpoint within
// float precision), we rebalance all items in the column.
//
// See docs/SCALABILITY.md for why this matters at scale.
// ─────────────────────────────────────────────────────────────

const MIN_GAP = 0.001; // threshold below which we rebalance

/**
 * Compute a new position for a task moving to `targetColumnId`.
 *
 * @param {object} prisma - prisma client
 * @param {string} targetColumnId - destination column
 * @param {string|null} beforeTaskId - place before this task; if null → append
 * @returns {number} new position value
 */
async function nextPosition(prisma, targetColumnId, beforeTaskId = null) {
  const tasks = await prisma.task.findMany({
    where: { columnId: targetColumnId },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

  // No tasks in the column yet → first slot.
  if (tasks.length === 0) return 100;

  if (!beforeTaskId) {
    // Append after the last task.
    return tasks[tasks.length - 1].position + 100;
  }

  const targetIndex = tasks.findIndex((t) => t.id === beforeTaskId);
  if (targetIndex <= 0) {
    // Before the first task.
    return tasks[0].position / 2;
  }

  const left = tasks[targetIndex - 1].position;
  const right = tasks[targetIndex].position;
  const mid = (left + right) / 2;

  // If gap is too small (e.g. repeated drags between same pair), rebalance.
  if (right - left < MIN_GAP) {
    return rebalance(prisma, targetColumnId, tasks, targetIndex);
  }

  return mid;
}

/**
 * Respace all tasks in a column evenly so positions don't collide.
 * Returns the new midpoint at the insert point.
 */
async function rebalance(prisma, columnId, tasks, insertIndex) {
  const spacing = 100;
  const updates = tasks.map((t, i) => {
    // Shift items at/after insert index down by one to make room.
    const pos = (i >= insertIndex ? i + 1 : i) * spacing;
    return prisma.task.update({ where: { id: t.id }, data: { position: pos } });
  });

  await prisma.$transaction(updates);
  return (insertIndex) * spacing; // midpoint for the new task
}

module.exports = { nextPosition };