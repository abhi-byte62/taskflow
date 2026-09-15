// Role-Based Access Control (RBAC).
//
// Hierarchy: OWNER > ADMIN > MEMBER > VIEWER.
// Every sensitive endpoint resolves the workspace/board, checks membership,
// then checks the role against the permission matrix below.
//
// ⚠️ The client may hide buttons, but the BACKEND is the enforcement point.
//    Hiding a "Delete" button is not security — see docs/ARCHITECTURE.md.

const ROLES = { OWNER: 'OWNER', ADMIN: 'ADMIN', MEMBER: 'MEMBER', VIEWER: 'VIEWER' };

// action → roles allowed
const PERMISSIONS = {
  // Workspace level
  'workspace.view':       [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER],
  'workspace.update':     [ROLES.OWNER],
  'workspace.delete':     [ROLES.OWNER],
  'workspace.manageMembers': [ROLES.OWNER, ROLES.ADMIN],
  'workspace.createBoard':  [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
  'workspace.manageBoard':  [ROLES.OWNER, ROLES.ADMIN], // edit/archive/delete boards

  // Board level
  'board.view':          [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER],
  'board.update':        [ROLES.OWNER, ROLES.ADMIN],
  'board.delete':        [ROLES.OWNER, ROLES.ADMIN],
  'board.manageColumns': [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
  'board.manageMembers': [ROLES.OWNER, ROLES.ADMIN],

  // Task level
  'task.create':         [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
  'task.update':         [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
  'task.move':           [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
  'task.delete':         [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
  'task.comment':        [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],

  // Labels
  'label.manage':        [ROLES.OWNER, ROLES.ADMIN, ROLES.MEMBER],
};

// Can a role do an action? Hierarchy makes VIEWER never exceed itself, etc.
function can(role, action) {
  const allowed = PERMISSIONS[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

module.exports = { ROLES, PERMISSIONS, can };