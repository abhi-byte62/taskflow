const prisma = require('../utils/prisma');
const { errors, AppError } = require('../errors');
const { can } = require('../utils/permissions');

// ── Access resolvers ─────────────────────────────────────────
// Resolve the resource from route params, load the caller's role, then
// enforce the permission. Each returns the entity so controllers can reuse it
// without a second query.

async function loadWorkspaceContext(workspaceId, userId) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: { where: { userId } } },
  });
  if (!workspace) throw errors.notFound('Workspace not found');
  return workspace;
}

async function loadBoardContext(boardId, userId) {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      members: { where: { userId } },
      workspace: { include: { members: { where: { userId } } } },
    },
  });
  if (!board) throw errors.notFound('Board not found');
  return board;
}

// effective role for a user on a board:
//   explicit BoardMember.role → else inherited from WorkspaceMember.role
async function boardRoleOf(userId, board) {
  const direct = board.members.find((m) => m.userId === userId);
  if (direct) return direct.role;
  const wsMember = board.workspace.members.find((m) => m.userId === userId);
  return wsMember?.role ?? null;
}

// ── Middleware factories ─────────────────────────────────────

// authorizeWorkspace('workspace.view')
// Requires membership + permission at the workspace level. Handles /api/workspaces/:id.
function authorizeWorkspace(action, idSource = (req) => req.params.id) {
  return async (req, res, next) => {
    try {
      const workspace = await loadWorkspaceContext(idSource(req), req.user.id);
      const membership = workspace.members[0];

      if (!membership) throw errors.forbidden('You are not a member of this workspace');

      if (!can(membership.role, action)) {
        throw errors.forbidden(`Role '${membership.role}' cannot ${action}`);
      }

      req.workspace = workspace;
      req.role = membership.role;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// authorizeBoard('task.update', (req) => req.params.boardId)
// Resolves board + inherited workspace role, enforces the action.
function authorizeBoard(action, idSource = (req) => req.params.id) {
  return async (req, res, next) => {
    try {
      const resolvedId = await idSource(req);
      const board = await loadBoardContext(resolvedId, req.user.id);
      const role = await boardRoleOf(req.user.id, board);

      if (!role) throw errors.forbidden('You do not have access to this board');
      if (!can(role, action)) {
        throw errors.forbidden(`Role '${role}' cannot ${action} on this board`);
      }

      req.board = board;
      req.boardRole = role;
      req.workspace = board.workspace;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authorizeWorkspace, authorizeBoard, boardRoleOf };