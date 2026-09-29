import { describe, it, expect, beforeEach, vi } from 'vitest';
const prisma = require('../src/utils/prisma.js');
const taskService = require('../src/services/taskService.js');
const { AppError } = require('../src/errors/index.js');

describe('Task Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTasks', () => {
    it('should query tasks with boardId and return paginated data', async () => {
      const mockTasks = [
        { id: 't1', title: 'Task 1', position: 100 },
        { id: 't2', title: 'Task 2', position: 200 },
      ];
      vi.spyOn(prisma.task, 'findMany').mockResolvedValue(mockTasks);

      const result = await taskService.getTasks('b1', { limit: 10 });
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { boardId: 'b1' },
        orderBy: { position: 'asc' },
        take: 11,
        include: {
          assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { select: { label: true } },
        },
      });
      expect(result.data).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('should handle cursor pagination when more items exist', async () => {
      const mockTasks = [
        { id: 't1', title: 'Task 1', position: 100 },
        { id: 't2', title: 'Task 2', position: 200 },
        { id: 't3', title: 'Task 3', position: 300 },
      ];
      vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({ position: 50 });
      vi.spyOn(prisma.task, 'findMany').mockResolvedValue(mockTasks);

      const result = await taskService.getTasks('b1', { limit: 2, cursor: 't0' });
      expect(result.hasMore).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBe('t2');
    });
  });

  describe('createTask', () => {
    it('should create a task with default column, gap position, assignees, and audit log', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return await cb(prisma);
      });
      vi.spyOn(prisma.column, 'findFirst').mockResolvedValue({ id: 'col-1' });
      vi.spyOn(prisma.task, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.task, 'create').mockResolvedValue({ id: 'new-task', title: 'New Task' });
      vi.spyOn(prisma.activityLog, 'create').mockResolvedValue({});
      vi.spyOn(prisma.taskAssignment, 'createMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({
        id: 'new-task',
        title: 'New Task',
        assignees: [{ user: { id: 'u2', name: 'Bob', avatarUrl: null } }],
        labels: [],
      });
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ name: 'Alice' });
      vi.spyOn(prisma.notification, 'createMany').mockResolvedValue({ count: 1 });

      const task = await taskService.createTask('b1', 'u1', {
        title: 'New Task',
        assigneeIds: ['u2'],
      });

      expect(prisma.task.create).toHaveBeenCalled();
      expect(prisma.taskAssignment.createMany).toHaveBeenCalledWith({
        data: [{ taskId: 'new-task', userId: 'u2' }],
      });
      expect(task.id).toBe('new-task');
    });
  });

  describe('updateTask & OCC', () => {
    it('should update task and bump version when current version matches', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return await cb(prisma);
      });
      vi.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 1 });
      vi.spyOn(prisma.taskAssignment, 'deleteMany').mockResolvedValue({ count: 0 });
      vi.spyOn(prisma.taskLabel, 'deleteMany').mockResolvedValue({ count: 0 });
      vi.spyOn(prisma.activityLog, 'create').mockResolvedValue({});
      vi.spyOn(prisma.notification, 'createMany').mockResolvedValue({ count: 0 });

      vi.spyOn(prisma.task, 'findUnique').mockImplementation(async () => ({
        id: 't1',
        title: 'Updated Title',
        boardId: 'b1',
        version: 2,
        assignees: [],
        labels: [],
      }));
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ name: 'Alice' });

      const updated = await taskService.updateTask('t1', 'u1', {
        title: 'Updated Title',
        version: 1,
      });

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: 't1', version: 1 },
        data: { title: 'Updated Title', version: 2 },
      });
      expect(updated.title).toBe('Updated Title');
    });

    it('should throw 409 Conflict when version does not match (OCC failure)', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return await cb(prisma);
      });
      vi.spyOn(prisma.task, 'updateMany').mockResolvedValue({ count: 0 });

      await expect(
        taskService.updateTask('t1', 'u1', { title: 'Stale Update', version: 1 })
      ).rejects.toThrow(AppError);
    });
  });

  describe('moveTask & deleteTask', () => {
    it('should move task to new column and bump version', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return await cb(prisma);
      });
      vi.spyOn(prisma.task, 'findUnique').mockImplementation(async () => ({
        id: 't1',
        title: 'Moved Task',
        boardId: 'b1',
        columnId: 'col-1',
        version: 1,
        assignees: [],
        labels: [],
      }));
      vi.spyOn(prisma.task, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.task, 'update').mockResolvedValue({});
      vi.spyOn(prisma.activityLog, 'create').mockResolvedValue({});
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({ name: 'Alice' });
      vi.spyOn(prisma.notification, 'createMany').mockResolvedValue({ count: 0 });

      const moved = await taskService.moveTask('t1', 'u1', {
        columnId: 'col-2',
        version: 1,
      });

      expect(prisma.task.update).toHaveBeenCalled();
      expect(moved.id).toBe('t1');
    });

    it('should throw 409 Conflict when moving task with stale version', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return await cb(prisma);
      });
      vi.spyOn(prisma.task, 'findUnique').mockResolvedValueOnce({ id: 't1', version: 2, boardId: 'b1' });

      await expect(
        taskService.moveTask('t1', 'u1', { columnId: 'col-2', version: 1 })
      ).rejects.toThrow(AppError);
    });

    it('should delete task and log activity in transaction', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb) => {
        return await cb(prisma);
      });
      vi.spyOn(prisma.task, 'findUnique').mockResolvedValue({ id: 't1', title: 'Task to delete', boardId: 'b1' });
      vi.spyOn(prisma.activityLog, 'create').mockResolvedValue({});
      vi.spyOn(prisma.task, 'delete').mockResolvedValue({});

      const deleted = await taskService.deleteTask('t1', 'u1');
      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
      expect(deleted.id).toBe('t1');
    });
  });
});
