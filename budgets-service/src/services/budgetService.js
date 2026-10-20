const defaultRepository = require('../store/budgetRepository');
const logger = require('../utils/logger');

const MAX_CATEGORY_LENGTH = 50;
const MAX_PERIOD_LENGTH = 50;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
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

function normalizePeriod(period) {
  if (typeof period !== 'string' || !period.trim()) {
    throw badRequest('El periodo es obligatorio.');
  }
  const normalized = period.trim().toLowerCase();
  if (normalized.length > MAX_PERIOD_LENGTH) {
    throw badRequest(`El periodo no puede superar ${MAX_PERIOD_LENGTH} caracteres.`);
  }
  return normalized;
}

class BudgetService {
  constructor(repository = defaultRepository) {
    this.repository = repository;
  }

  /**
   * Crea un presupuesto por categoría para el usuario autenticado.
   * @param {string} userId
   * @param {{ category: string, limitAmount: number, period: string }} input
   */
  create(userId, { category, limitAmount, period } = {}) {
    const normalizedCategory = normalizeCategory(category);
    if (typeof limitAmount !== 'number' || !Number.isFinite(limitAmount) || limitAmount <= 0) {
      throw badRequest('El monto límite debe ser un número mayor a cero.');
    }
    const normalizedPeriod = normalizePeriod(period);

    const budget = this.repository.create({
      userId,
      category: normalizedCategory,
      limitAmount: Math.round(limitAmount * 100) / 100,
      period: normalizedPeriod,
    });
    logger.info('Presupuesto creado', { budgetId: budget.id, userId });
    return { budget };
  }

  /**
   * Lista los presupuestos del usuario con filtros opcionales.
   * @param {string} userId
   * @param {{ category?: string, period?: string }} filters
   */
  list(userId, { category, period } = {}) {
    const budgets = this.repository.findByUser(userId, {
      category: category ? normalizeCategory(category) : undefined,
      period: period ? normalizePeriod(period) : undefined,
    });
    return { budgets, count: budgets.length };
  }
}

const defaultService = new BudgetService();

module.exports = defaultService;
module.exports.BudgetService = BudgetService;
