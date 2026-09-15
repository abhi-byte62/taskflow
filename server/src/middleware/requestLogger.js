const logger = require('../utils/logger');

// One structured line per request with duration — input to any APM/dashboard.
// Example:
//   [requestId=8f31] PATCH /api/tasks/123 status=200 duration=43ms
function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('request', {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      userId: req.user?.id,
    });
  });

  next();
}

module.exports = { requestLogger };