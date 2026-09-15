// Seed script — run after migrations to populate the database with demo data.
// Usage: npm run seed  (or npx prisma db seed)
//
// Creates:
//   User: demo@taskflow.dev / password123
//   Workspace: "TaskFlow Team"
//   Board: "Sprint Board" with default columns + 3 sample tasks

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database…');

  // ── User ───────────────────────────────────────────────
  const hashedPw = await bcrypt.hash('password123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@taskflow.dev' },
    update: {},
    create: {
      email: 'demo@taskflow.dev',
      name: 'Demo User',
      password: hashedPw,
    },
  });
  console.log(`  ✅ User: ${user.email} (${user.id})`);

  // ── Workspace ──────────────────────────────────────────
  // Check if workspace already exists for this owner
  let workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id, name: 'TaskFlow Team' } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: 'TaskFlow Team', description: 'Demo workspace for TaskFlow', ownerId: user.id },
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
    });
  }
  console.log(`  ✅ Workspace: ${workspace.name} (${workspace.id})`);

  // ── Board ──────────────────────────────────────────────
  let board = await prisma.board.findFirst({ where: { workspaceId: workspace.id, name: 'Sprint Board' } });
  if (!board) {
    board = await prisma.board.create({
      data: { name: 'Sprint Board', description: 'Current sprint', workspaceId: workspace.id, ownerId: user.id },
    });
    // Create default columns
    const defaultCols = ['To Do', 'In Progress', 'Review', 'Done'];
    await prisma.column.createMany({ data: defaultCols.map((name, i) => ({ name, boardId: board.id, position: (i + 1) * 100 })) });
  }
  console.log(`  ✅ Board: ${board.name} (${board.id})`);

  // ── Columns (load existing) ────────────────────────────
  const columns = await prisma.column.findMany({ where: { boardId: board.id }, orderBy: { position: 'asc' } });
  console.log(`  ✅ Columns: ${columns.map((c) => c.name).join(', ')}`);

  // ── Labels ─────────────────────────────────────────────
  const labelsData = [
    { name: 'Frontend', color: '#3b82f6' },
    { name: 'Backend', color: '#10b981' },
    { name: 'Bug', color: '#ef4444' },
    { name: 'Enhancement', color: '#8b5cf6' },
  ];
  const existingLabels = await prisma.label.findMany({ where: { boardId: board.id } });
  if (existingLabels.length === 0) {
    for (const label of labelsData) {
      await prisma.label.create({ data: { ...label, boardId: board.id } });
    }
    console.log(`  ✅ Labels: ${labelsData.map((l) => l.name).join(', ')}`);
  } else {
    console.log(`  ✅ Labels: ${existingLabels.length} already exist`);
  }

  // ── Tasks ──────────────────────────────────────────────
  const existingTasks = await prisma.task.findMany({ where: { boardId: board.id } });
  if (existingTasks.length === 0) {
    const tasksData = [
      { title: 'Design landing page', description: 'Create wireframes and high-fidelity mockups for the marketing site.', status: 'TODO', priority: 'HIGH', columnId: columns[0]?.id, position: 100, assignees: [user.id] },
      { title: 'Implement user authentication', description: 'JWT + Google OAuth. See docs/AUTH.md for the design.', status: 'IN_PROGRESS', priority: 'URGENT', columnId: columns[1]?.id, position: 100, assignees: [user.id] },
      { title: 'Add drag-and-drop to task board', description: 'Use @dnd-kit with keyboard accessibility.', status: 'TODO', priority: 'MEDIUM', columnId: columns[0]?.id, position: 200, assignees: [] },
    ];

    for (const task of tasksData) {
      if (!task.columnId) continue; // skip if no columns
      const { assignees, ...data } = task;
      const created = await prisma.task.create({
        data: { ...data, boardId: board.id, createdById: user.id },
      });
      if (assignees?.length) {
        await prisma.taskAssignment.createMany({ data: assignees.map((uid) => ({ taskId: created.id, userId: uid })) });
      }
    }
    console.log(`  ✅ Tasks: ${tasksData.length} created`);
  } else {
    console.log(`  ✅ Tasks: ${existingTasks.length} already exist`);
  }

  console.log('\n🎉 Seed complete! Log in with: demo@taskflow.dev / password123\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());