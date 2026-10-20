/**
 * Cliente HTTP de budgets-service para consultar los presupuestos configurados
 * del usuario autenticado reenviando el token Bearer.
 */

const config = require('../config');
const logger = require('../utils/logger');

/**
 * @param {string} authorizationHeader Cabecera `Authorization: Bearer <token>`
 * @param {{ category?: string, period?: string }} filters
 * @returns {Promise<Array<{ id: string, userId: string, category: string, limitAmount: number, period: string }>>}
 */
async function listBudgets(authorizationHeader, { category, period } = {}) {
  const url = new URL('/budgets', config.budgetsServiceUrl);
  if (category) url.searchParams.set('category', category);
  if (period) url.searchParams.set('period', period);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: authorizationHeader },
      signal: AbortSignal.timeout(config.serviceTimeoutMs),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(data.error || 'Error al consultar presupuestos.');
      err.statusCode = response.status >= 500 ? 503 : response.status;
      throw err;
    }
    return Array.isArray(data.budgets) ? data.budgets : [];
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('No se pudo contactar a budgets-service', { message: error.message });
    const err = new Error('Servicio de presupuestos no disponible.');
    err.statusCode = 503;
    throw err;
  }
}

module.exports = { listBudgets };
