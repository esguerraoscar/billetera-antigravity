/**
 * Logger de transactions-service.
 * Mismo formato que auth-service; redacta credenciales y tokens por si
 * llegaran a incluirse en los metadatos de un log.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'jwt',
  'secret',
  'credentials',
]);

const JWT_REGEX = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9._-]+/gi;

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(BEARER_REGEX, 'Bearer [REDACTED]')
    .replace(JWT_REGEX, '[REDACTED_TOKEN]');
}

function sanitizeData(data) {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') return sanitizeString(data);
  if (Array.isArray(data)) return data.map((item) => sanitizeData(item));
  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(data)) {
      sanitized[key] = SENSITIVE_KEYS.has(key.toLowerCase())
        ? '[REDACTED]'
        : sanitizeData(val);
    }
    return sanitized;
  }
  return data;
}

function formatLogEntry(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'transactions-service',
    level,
    message: sanitizeString(message),
    meta: sanitizeData(meta),
  });
}

const logger = {
  sanitizeData,
  info(message, meta = {}) {
    const entry = formatLogEntry('INFO', message, meta);
    if (process.env.NODE_ENV !== 'test') console.log(entry);
    return entry;
  },
  warn(message, meta = {}) {
    const entry = formatLogEntry('WARN', message, meta);
    if (process.env.NODE_ENV !== 'test') console.warn(entry);
    return entry;
  },
  error(message, meta = {}) {
    const entry = formatLogEntry('ERROR', message, meta);
    if (process.env.NODE_ENV !== 'test') console.error(entry);
    return entry;
  },
};

module.exports = logger;
