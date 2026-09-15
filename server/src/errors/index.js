// Uniform error taxonomy. Every thrown AppError maps to ONE HTTP status
// and ONE stable machine-readable code, so the client can react predictably.
//
//   { success: false, error: { code, message, details? } }

const CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

const STATUS_BY_CODE = {
  [CODES.UNAUTHORIZED]: 401,
  [CODES.FORBIDDEN]: 403,
  [CODES.RESOURCE_NOT_FOUND]: 404,
  [CODES.VALIDATION_ERROR]: 400,
  [CODES.CONFLICT]: 409,
  [CODES.RATE_LIMITED]: 429,
  [CODES.INTERNAL_ERROR]: 500,
};

class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code] || 500;
    this.details = details; // e.g. zod field issues: { field: "message" }
  }
}

// Convenience constructors so call sites stay readable.
const errors = {
  unauthorized: (msg = 'Authentication required') => new AppError(CODES.UNAUTHORIZED, msg),
  forbidden: (msg = 'You do not have permission to do this') => new AppError(CODES.FORBIDDEN, msg),
  notFound: (msg = 'Resource not found') => new AppError(CODES.RESOURCE_NOT_FOUND, msg),
  validation: (details) => new AppError(CODES.VALIDATION_ERROR, 'Validation failed', details),
  conflict: (msg = 'Conflict with current server state') => new AppError(CODES.CONFLICT, msg),
  rateLimited: (msg = 'Too many requests') => new AppError(CODES.RATE_LIMITED, msg),
  internal: (msg = 'Internal server error') => new AppError(CODES.INTERNAL_ERROR, msg),
};

module.exports = { AppError, errors, CODES };