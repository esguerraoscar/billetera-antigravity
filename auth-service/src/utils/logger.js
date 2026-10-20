/**
 * Logger seguro de auth-service.
 * Cumple la regla de AGENTS.md: "Nunca logueas credenciales ni tokens en texto plano."
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'oldpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'jwt',
  'secret',
  'credentials',
]);

// Detecta cadenas con formato JWT (header.payload.signature en Base64URL) o Bearer tokens
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_REGEX = /Bearer\s+[A-Za-z0-9._-]+/gi;

function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(BEARER_REGEX, 'Bearer [REDACTED]')
    .replace(JWT_REGEX, '[REDACTED_TOKEN]');
}

function sanitizeData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(val);
      }
    }
    return sanitized;
  }

  return data;
}

function formatLogEntry(level, message, meta = {}) {
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'auth-service',
    level,
    message: sanitizeString(message),
    meta: sanitizeData(meta),
  });
}

const logger = {
  sanitizeData,
  info(message, meta = {}) {
    const entry = formatLogEntry('INFO', message, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.log(entry);
    }
    return entry;
  },
  warn(message, meta = {}) {
    const entry = formatLogEntry('WARN', message, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.warn(entry);
    }
    return entry;
  },
  error(message, meta = {}) {
    const entry = formatLogEntry('ERROR', message, meta);
    if (process.env.NODE_ENV !== 'test') {
      console.error(entry);
    }
    return entry;
  },
};

module.exports = logger;
