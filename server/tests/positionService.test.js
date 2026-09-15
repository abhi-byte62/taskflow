import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextPosition, rebalance } from '../src/services/positionService.js';

describe('positionService', () => {
  let mockPrisma;

  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma = {
      task: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (callbacks) => {
        if (typeof callbacks === 'function') {
          return await callbacks(mockPrisma);
        }
        return Promise.all(callbacks);
      }),
    };
  });

  it('should return 100 for empty column', async () => {
    mockPrisma.task.findMany.mockResolvedValue([]);
    const pos = await nextPosition(mockPrisma, 'col-1');
    expect(pos).toBe(100);
  });

  it('should append after last task', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      { id: 't1', position: 100 },
      { id: 't2', position: 200 },
    ]);
    const pos = await nextPosition(mockPrisma, 'col-1', null);
    expect(pos).toBe(300);
  });

  it('should return midpoint before first task', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      { id: 't1', position: 100 },
    ]);
    const pos = await nextPosition(mockPrisma, 'col-1', 't1');
    expect(pos).toBe(50);
  });

  it('should return midpoint between tasks', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      { id: 't1', position: 100 },
      { id: 't2', position: 200 },
    ]);
    const pos = await nextPosition(mockPrisma, 'col-1', 't2');
    expect(pos).toBe(150);
  });

  it('should rebalance when gap is too small', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      { id: 't1', position: 0 },
      { id: 't2', position: 0.0005 }, // gap < MIN_GAP (0.001)
    ]);
    mockPrisma.task.update.mockResolvedValue({});

    const pos = await nextPosition(mockPrisma, 'col-1', 't2');
    expect(mockPrisma.task.update).toHaveBeenCalled();
    expect(pos).toBeGreaterThan(0);
  });
});