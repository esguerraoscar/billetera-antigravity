const defaultRepository = require('../store/transactionRepository');
const logger = require('../utils/logger');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CATEGORY_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function normalizeCategory(category) {
  if (typeof category !== 'string' || !category.trim()) {
    throw badRequest('La categoría es obligatoria.');
  }
  const normalized = category.trim().toLowerCase();
  if (normalized.length > MAX_CATEGORY_LENGTH) {
    throw badRequest(`La categoría no puede superar ${MAX_CATEGORY_LENGTH} caracteres.`);
  }
  return normalized;
}

class TransactionService {
  constructor(repository = defaultRepository) {
    this.repository = repository;
  }

  /**
   * Registra un gasto para el usuario autenticado.
   * @param {string} userId
   * @param {{ amount: number, category: string, date: string, description?: string }} input
   */
  create(userId, { amount, category, date, description } = {}) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw badRequest('El monto debe ser un número mayor a cero.');
    }
    const normalizedCategory = normalizeCategory(category);
    if (!isValidDate(date)) {
      throw badRequest('La fecha es obligatoria y debe tener formato YYYY-MM-DD válido.');
    }
    if (description !== undefined && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      throw badRequest(`La descripción debe ser texto de máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`);
    }

    const transaction = this.repository.create({
      userId,
      amount: Math.round(amount * 100) / 100,
      category: normalizedCategory,
      date,
      description: description ? description.trim() : undefined,
    });
    logger.info('Transacción registrada', { transactionId: transaction.id, userId });
    return { transaction };
  }

  /**
   * Lista las transacciones del usuario con filtros opcionales.
   * @param {string} userId
   * @param {{ category?: string, from?: string, to?: string }} filters
   */
  list(userId, { category, from, to } = {}) {
    if (from !== undefined && !isValidDate(from)) throw badRequest('El filtro "from" debe tener formato YYYY-MM-DD.');
    if (to !== undefined && !isValidDate(to)) throw badRequest('El filtro "to" debe tener formato YYYY-MM-DD.');
    if (from && to && from > to) throw badRequest('"from" no puede ser posterior a "to".');

    const transactions = this.repository.findByUser(userId, {
      category: category ? normalizeCategory(category) : undefined,
      from,
      to,
    });
    return { transactions, count: transactions.length };
  }
}

const defaultService = new TransactionService();

module.exports = defaultService;
module.exports.TransactionService = TransactionService;
