const logger = require('../utils/logger');
const { AppError, CODES } = require('../errors');

// Central error handler — the ONLY place errors become HTTP responses.
// AppError → stable { code, message, details }. Anything else → 500 INTERNAL_ERROR.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const requestId = req.id;

  if (err instanceof AppError) {
    logger.warn('request_failed', {
      requestId,
      code: err.code,
      message: err.message,
      status: err.status,
    });
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  // Express body-parser throws SyntaxError on malformed JSON.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: { code: CODES.VALIDATION_ERROR, message: 'Malformed JSON body' },
    });
  }

  logger.error('unhandled_error', { requestId, error: err.message, stack: err.stack });
  return res.status(500).json({
    success: false,
    error: { code: CODES.INTERNAL_ERROR, message: 'Internal server error' },
  });
}

module.exports = { errorHandler };