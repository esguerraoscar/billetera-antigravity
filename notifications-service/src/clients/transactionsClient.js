/**
 * Cliente HTTP de transactions-service para consultar el consumo acumulado
 * del usuario autenticado por categoría y rango de fechas reenviando el token Bearer.
 */

const config = require('../config');
const logger = require('../utils/logger');

/**
 * @param {string} authorizationHeader Cabecera `Authorization: Bearer <token>`
 * @param {{ category?: string, from?: string, to?: string }} filters
 * @returns {Promise<Array<{ id: string, userId: string, amount: number, category: string, date: string }>>}
 */
async function listTransactions(authorizationHeader, { category, from, to } = {}) {
  const url = new URL('/transactions', config.transactionsServiceUrl);
  if (category) url.searchParams.set('category', category);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: authorizationHeader },
      signal: AbortSignal.timeout(config.serviceTimeoutMs),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = new Error(data.error || 'Error al consultar transacciones.');
      err.statusCode = response.status >= 500 ? 503 : response.status;
      throw err;
    }
    return Array.isArray(data.transactions) ? data.transactions : [];
  } catch (error) {
    if (error.statusCode) throw error;
    logger.error('No se pudo contactar a transactions-service', { message: error.message });
    const err = new Error('Servicio de transacciones no disponible.');
    err.statusCode = 503;
    throw err;
  }
}

module.exports = { listTransactions };
