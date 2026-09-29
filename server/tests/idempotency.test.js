import { describe, it, expect, beforeEach, vi } from 'vitest';
const prisma = require('../src/utils/prisma.js');
const { idempotency } = require('../src/middleware/idempotency.js');

describe('Idempotency Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    vi.restoreAllMocks();
    req = {
      headers: {},
      user: { id: 'u1' },
    };
    res = {
      statusCode: 200,
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('should bypass middleware when Idempotency-Key header is absent', async () => {
    const findSpy = vi.spyOn(prisma.idempotencyKey, 'findUnique');
    await idempotency(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(findSpy).not.toHaveBeenCalled();
  });

  it('should replay stored response when idempotency key exists', async () => {
    req.headers['idempotency-key'] = 'uuid-key-1';
    vi.spyOn(prisma.idempotencyKey, 'findUnique').mockResolvedValue({
      responseJson: {
        status: 201,
        body: { success: true, data: { id: 'task-1' } },
      },
    });

    await idempotency(req, res, next);

    expect(prisma.idempotencyKey.findUnique).toHaveBeenCalledWith({
      where: { key_userId: { key: 'uuid-key-1', userId: 'u1' } },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'task-1' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow request to proceed and wrap res.json when key is new', async () => {
    req.headers['idempotency-key'] = 'uuid-new-key';
    vi.spyOn(prisma.idempotencyKey, 'findUnique').mockResolvedValue(null);
    const createSpy = vi.spyOn(prisma.idempotencyKey, 'create').mockResolvedValue({});

    await idempotency(req, res, next);

    expect(next).toHaveBeenCalled();
    // Simulate endpoint calling res.json
    res.json({ success: true, data: { id: 'new-task' } });
    expect(createSpy).toHaveBeenCalled();
  });
});
