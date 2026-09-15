const crypto = require('crypto');

// Attach a correlation ID to every request so a single user action can be
// traced across logs: [requestId=8f31] POST /api/tasks status=201 duration=43ms
// Respects an incoming X-Request-Id if one exists (e.g. from a load balancer).
function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };