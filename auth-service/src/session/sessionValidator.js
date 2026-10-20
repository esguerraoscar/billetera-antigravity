/**
 * MÓDULO CENTRAL ÚNICO DE VALIDACIÓN DE SESIÓN
 *
 * Cumple la directiva de AGENTS.md:
 * "Toda validación de sesión debe pasar por un solo módulo central."
 *
 * Ningún otro archivo en auth-service verifica firmas JWT ni valida sesiones
 * directamente; tanto los endpoints como los middlewares delegan aquí.
 */

const crypto = require('node:crypto');
const config = require('../config');
const logger = require('../utils/logger');

// Registro en memoria de identificadores de token (jti) revocados (logout)
const revokedTokenIds = new Set();

function base64UrlEncode(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecodeToString(input) {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

function signHmacSha256(data, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(data);
  return base64UrlEncode(hmac.digest());
}

/**
 * Emite un token JWT firmado (HS256) para un usuario autenticado.
 *
 * @param {{ id: string, email: string, name: string }} user
 * @returns {{ token: string, expiresAt: number, jti: string }}
 */
function issueSessionToken(user) {
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const exp = nowInSeconds + config.jwtExpiresInSeconds;
  const jti = crypto.randomUUID();

  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    iss: config.jwtIssuer,
    iat: nowInSeconds,
    exp,
    jti,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signHmacSha256(signingInput, config.jwtSecret);

  return {
    token: `${signingInput}.${signature}`,
    expiresAt: exp * 1000,
    jti,
  };
}

/**
 * Extrae el token de una cabecera Authorization ("Bearer <token>") o de un string directo.
 *
 * @param {string | undefined} rawInput
 * @returns {string | null}
 */
function extractToken(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') {
    return null;
  }
  const trimmed = rawInput.trim();
  if (trimmed.toLowerCase().startsWith('bearer ')) {
    const tokenPart = trimmed.slice(7).trim();
    return tokenPart || null;
  }
  return trimmed || null;
}

/**
 * Valida de forma centralizada un token o cabecera de sesión.
 *
 * @param {string | undefined} tokenOrHeader
 * @returns {{ valid: boolean, session?: object, reason?: string }}
 */
function validateSession(tokenOrHeader) {
  const token = extractToken(tokenOrHeader);
  if (!token) {
    return { valid: false, reason: 'Token de sesión no proporcionado.' };
  }

  const segments = token.split('.');
  if (segments.length !== 3) {
    return { valid: false, reason: 'Formato de token inválido.' };
  }

  const [encodedHeader, encodedPayload, providedSignature] = segments;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = signHmacSha256(signingInput, config.jwtSecret);

  const providedBuffer = Buffer.from(providedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    logger.warn('Intento de validación con firma JWT inválida');
    return { valid: false, reason: 'Firma de sesión inválida.' };
  }

  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecodeToString(encodedHeader));
    payload = JSON.parse(base64UrlDecodeToString(encodedPayload));
  } catch {
    return { valid: false, reason: 'Payload de sesión malformado.' };
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    return { valid: false, reason: 'Algoritmo de token no soportado.' };
  }

  if (payload.iss !== config.jwtIssuer) {
    return { valid: false, reason: 'Emisor de sesión no reconocido.' };
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || nowInSeconds >= payload.exp) {
    return { valid: false, reason: 'La sesión ha expirado.' };
  }

  if (payload.jti && revokedTokenIds.has(payload.jti)) {
    return { valid: false, reason: 'La sesión fue revocada.' };
  }

  return {
    valid: true,
    session: {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      issuedAt: payload.iat * 1000,
      expiresAt: payload.exp * 1000,
      jti: payload.jti,
    },
  };
}

/**
 * Revoca una sesión activa tras validarla por el mismo módulo central.
 *
 * @param {string | undefined} tokenOrHeader
 * @returns {{ revoked: boolean, reason?: string }}
 */
function revokeSession(tokenOrHeader) {
  const result = validateSession(tokenOrHeader);
  if (!result.valid) {
    return { revoked: false, reason: result.reason };
  }

  if (result.session.jti) {
    revokedTokenIds.add(result.session.jti);
  }
  logger.info('Sesión revocada correctamente', { userId: result.session.userId });
  return { revoked: true };
}

/**
 * Helper centralizado para proteger rutas HTTP.
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {{ valid: boolean, session?: object, reason?: string }}
 */
function validateRequestSession(req) {
  const authHeader = req && req.headers ? req.headers.authorization : undefined;
  return validateSession(authHeader);
}

module.exports = {
  issueSessionToken,
  validateSession,
  validateRequestSession,
  revokeSession,
  extractToken,
};
