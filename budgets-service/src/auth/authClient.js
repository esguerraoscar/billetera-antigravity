/**
 * Cliente de auth-service. Es el ÚNICO punto por el que budgets-service
 * autentica peticiones: delega la validación del JWT en `GET /auth/verify` de
 * auth-service (que mantiene el módulo central de sesión), sin conocer el
 * secreto JWT ni verificar firmas localmente.
 */

const config = require('../config');
const logger = require('../utils/logger');

/**
 * @param {string | undefined} authorizationHeader Cabecera `Authorization: Bearer <token>`
 * @returns {Promise<{ valid: boolean, userId?: string, reason?: string }>}
 */
async function verifySession(authorizationHeader) {
  if (!authorizationHeader) {
    return { valid: false, reason: 'Token de sesión no proporcionado.' };
  }

  try {
    const response = await fetch(`${config.authServiceUrl}/auth/verify`, {
      method: 'GET',
      headers: { Authorization: authorizationHeader },
      signal: AbortSignal.timeout(config.authTimeoutMs),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.valid || !data.user?.id) {
      return { valid: false, reason: data.error || 'Sesión inválida.' };
    }
    return { valid: true, userId: data.user.id };
  } catch (error) {
    logger.error('No se pudo contactar a auth-service', { message: error.message });
    const err = new Error('Servicio de autenticación no disponible.');
    err.statusCode = 503;
    throw err;
  }
}

module.exports = { verifySession };
