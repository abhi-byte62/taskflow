const prisma = require('../utils/prisma');
const { errors } = require('../errors');

// Idempotency protection for "dangerous" POST endpoints.
//
// The client sends `Idempotency-Key: <uuid>`. The first request stores the
// successful response body keyed by (key, userId). A retry after a network
// timeout returns the stored response instead of creating a duplicate.
//
// "POST /tasks" explored in docs/CONCURRENCY.md — chosen because duplicate task
// creation is the most visible harm a retry can cause.
async function idempotency(req, res, next) {
  const key = req.headers['idempotency-key'];

  // Optional header — endpoints that mount this middleware still work without it.
  if (!key) return next();

  try {
    const existing = await prisma.idempotencyKey.findUnique({
      where: { key_userId: { key, userId: req.user.id } },
    });

    if (existing) {
      // Replay the exact stored response.
      return res
        .status(existing.responseJson.status)
        .json(existing.responseJson.body);
    }

    // Buffer the response so we can store it once it's written.
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      originalJson(body);
      storeKey(key, req.user.id, res.statusCode, body).catch(() => {});
      return res;
    };

    next();
  } catch (err) {
    next(errors.internal('Idempotency check failed'));
  }
}

async function storeKey(key, userId, status, body) {
  await prisma.idempotencyKey.create({
    data: {
      key,
      userId,
      responseJson: { status, body },
    },
  });
}

module.exports = { idempotency };