// Structured JSON logger — one line per event, machine-parseable.
// In dev we pretty-print; in prod we emit compact JSON for log shippers.
// Every log carries a `requestId` when one is attached to the request.

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

function base(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  };

  if (isDev) {
    const line = `${entry.ts} [${entry.level.toUpperCase()}]`;
    const rest = JSON.stringify(entry, null, 2);
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](
      `${line} ${message}\n${rest}`
    );
  } else {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
  }
}

const logger = {
  info: (msg, meta) => base('info', msg, meta),
  warn: (msg, meta) => base('warn', msg, meta),
  error: (msg, meta) => base('error', msg, meta),
};

module.exports = logger;