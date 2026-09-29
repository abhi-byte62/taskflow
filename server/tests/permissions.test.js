import { describe, it, expect } from 'vitest';
const { ROLES, PERMISSIONS, can } = require('../src/utils/permissions.js');

describe('Permissions & RBAC Matrix', () => {
  it('should define four standard roles in hierarchy', () => {
    expect(ROLES).toEqual({
      OWNER: 'OWNER',
      ADMIN: 'ADMIN',
      MEMBER: 'MEMBER',
      VIEWER: 'VIEWER',
    });
  });

  it('should allow OWNER all workspace management permissions', () => {
    expect(can(ROLES.OWNER, 'workspace.view')).toBe(true);
    expect(can(ROLES.OWNER, 'workspace.update')).toBe(true);
    expect(can(ROLES.OWNER, 'workspace.delete')).toBe(true);
    expect(can(ROLES.OWNER, 'workspace.manageMembers')).toBe(true);
    expect(can(ROLES.OWNER, 'workspace.createBoard')).toBe(true);
  });

  it('should allow ADMIN board management but not workspace deletion/updates', () => {
    expect(can(ROLES.ADMIN, 'workspace.view')).toBe(true);
    expect(can(ROLES.ADMIN, 'workspace.manageMembers')).toBe(true);
    expect(can(ROLES.ADMIN, 'workspace.update')).toBe(false);
    expect(can(ROLES.ADMIN, 'workspace.delete')).toBe(false);
    expect(can(ROLES.ADMIN, 'board.update')).toBe(true);
    expect(can(ROLES.ADMIN, 'board.delete')).toBe(true);
  });

  it('should allow MEMBER to view, create tasks, and comment, but not delete boards', () => {
    expect(can(ROLES.MEMBER, 'workspace.view')).toBe(true);
    expect(can(ROLES.MEMBER, 'board.view')).toBe(true);
    expect(can(ROLES.MEMBER, 'task.create')).toBe(true);
    expect(can(ROLES.MEMBER, 'task.update')).toBe(true);
    expect(can(ROLES.MEMBER, 'task.move')).toBe(true);
    expect(can(ROLES.MEMBER, 'task.delete')).toBe(true);
    expect(can(ROLES.MEMBER, 'task.comment')).toBe(true);
    expect(can(ROLES.MEMBER, 'board.update')).toBe(false);
    expect(can(ROLES.MEMBER, 'board.delete')).toBe(false);
    expect(can(ROLES.MEMBER, 'workspace.delete')).toBe(false);
  });

  it('should restrict VIEWER to read-only actions', () => {
    expect(can(ROLES.VIEWER, 'workspace.view')).toBe(true);
    expect(can(ROLES.VIEWER, 'board.view')).toBe(true);
    expect(can(ROLES.VIEWER, 'task.create')).toBe(false);
    expect(can(ROLES.VIEWER, 'task.update')).toBe(false);
    expect(can(ROLES.VIEWER, 'task.move')).toBe(false);
    expect(can(ROLES.VIEWER, 'task.delete')).toBe(false);
    expect(can(ROLES.VIEWER, 'task.comment')).toBe(false);
    expect(can(ROLES.VIEWER, 'label.manage')).toBe(false);
  });

  it('should return false for unknown actions or invalid roles', () => {
    expect(can('UNKNOWN_ROLE', 'task.create')).toBe(false);
    expect(can(ROLES.OWNER, 'invalid.action')).toBe(false);
  });
});
