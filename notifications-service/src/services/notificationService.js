const defaultRepository = require('../store/notificationRepository');
const defaultBudgetsClient = require('../clients/budgetsClient');
const defaultTransactionsClient = require('../clients/transactionsClient');
const config = require('../config');
const logger = require('../utils/logger');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CATEGORY_LENGTH = 50;
const MAX_PERIOD_LENGTH = 50;
const VALID_LEVELS = new Set(['warning', 'exceeded']);

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

function normalizePeriod(period) {
  if (typeof period !== 'string' || !period.trim()) {
    throw badRequest('El periodo no es válido.');
  }
  const normalized = period.trim().toLowerCase();
  if (normalized.length > MAX_PERIOD_LENGTH) {
    throw badRequest(`El periodo no puede superar ${MAX_PERIOD_LENGTH} caracteres.`);
  }
  return normalized;
}

function getMonthDateRange(dateStr) {
  const [yearStr, monthStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return {
    monthPeriod: `${yearStr}-${monthStr}`,
    from: `${yearStr}-${monthStr}-01`,
    to: lastDay,
  };
}

class NotificationService {
  constructor(
    repository = defaultRepository,
    budgetsClient = defaultBudgetsClient,
    transactionsClient = defaultTransactionsClient,
    options = {}
  ) {
    this.repository = repository;
    this.budgetsClient = budgetsClient;
    this.transactionsClient = transactionsClient;
    this.warningThreshold = options.warningThreshold ?? config.warningThreshold;
  }

  /**
   * Evalúa un evento de nueva transacción contra el presupuesto correspondiente
   * del usuario y genera una alerta (warning o exceeded) si corresponde.
   *
   * @param {string} userId
   * @param {object} payload Evento de transacción (plano o bajo `{ transaction }`)
   * @param {string} authorizationHeader Cabecera Authorization para consultar servicios
   */
  async evaluateTransaction(userId, payload = {}, authorizationHeader) {
    const rawTx =
      payload && typeof payload.transaction === 'object' && payload.transaction !== null
        ? payload.transaction
        : payload || {};

    const amount = rawTx.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      throw badRequest('El monto debe ser un número mayor a cero.');
    }

    const normalizedCategory = normalizeCategory(rawTx.category);

    if (!isValidDate(rawTx.date)) {
      throw badRequest('La fecha es obligatoria y debe tener formato YYYY-MM-DD válido.');
    }

    const transactionId =
      typeof rawTx.id === 'string' && rawTx.id.trim()
        ? rawTx.id.trim()
        : typeof rawTx.transactionId === 'string' && rawTx.transactionId.trim()
          ? rawTx.transactionId.trim()
          : undefined;

    const { monthPeriod, from, to } = getMonthDateRange(rawTx.date);
    const targetPeriod = rawTx.period !== undefined ? normalizePeriod(rawTx.period) : monthPeriod;

    const budgets = await this.budgetsClient.listBudgets(authorizationHeader, {
      category: normalizedCategory,
    });

    const matchingBudget =
      budgets.find((b) => b.period === targetPeriod) ||
      budgets.find((b) => b.period === monthPeriod) ||
      budgets.find((b) => b.period === 'mensual');

    if (!matchingBudget) {
      return {
        alertGenerated: false,
        notification: null,
        reason: 'No existe un presupuesto activo para la categoría y periodo.',
      };
    }

    const transactions = await this.transactionsClient.listTransactions(authorizationHeader, {
      category: normalizedCategory,
      from,
      to,
    });

    const alreadyRecorded =
      Boolean(transactionId) && transactions.some((tx) => tx.id === transactionId);

    const historicalTotal = transactions.reduce(
      (sum, tx) => sum + (typeof tx.amount === 'number' ? tx.amount : 0),
      0
    );
    const spentAmount =
      Math.round((alreadyRecorded ? historicalTotal : historicalTotal + amount) * 100) / 100;
    const limitAmount = matchingBudget.limitAmount;
    const ratio = spentAmount / limitAmount;
    const usagePercentage = Math.round(ratio * 10000) / 100;

    let level = null;
    let message = null;

    if (spentAmount > limitAmount) {
      level = 'exceeded';
      message = `Has superado el presupuesto de "${normalizedCategory}" (${matchingBudget.period}): gastaste ${spentAmount} de ${limitAmount} (${usagePercentage}%).`;
    } else if (ratio >= this.warningThreshold) {
      level = 'warning';
      message = `Estás próximo a alcanzar el límite del presupuesto de "${normalizedCategory}" (${matchingBudget.period}): llevas ${spentAmount} de ${limitAmount} (${usagePercentage}%).`;
    }

    if (!level) {
      return {
        alertGenerated: false,
        notification: null,
        budget: matchingBudget,
        spentAmount,
        usagePercentage,
      };
    }

    const notification = this.repository.create({
      userId,
      budgetId: matchingBudget.id,
      transactionId,
      category: normalizedCategory,
      period: matchingBudget.period,
      level,
      message,
      spentAmount,
      limitAmount,
      usagePercentage,
    });

    logger.info('Alerta de presupuesto generada', {
      notificationId: notification.id,
      userId,
      category: normalizedCategory,
      level,
      usagePercentage,
    });

    return {
      alertGenerated: true,
      notification,
      budget: matchingBudget,
      spentAmount,
      usagePercentage,
    };
  }

  /**
   * Lista las alertas del usuario con filtros opcionales.
   * @param {string} userId
   * @param {{ category?: string, period?: string, level?: string }} filters
   */
  list(userId, { category, period, level } = {}) {
    let normalizedLevel;
    if (level !== undefined) {
      normalizedLevel = String(level).trim().toLowerCase();
      if (!VALID_LEVELS.has(normalizedLevel)) {
        throw badRequest('El filtro "level" debe ser "warning" o "exceeded".');
      }
    }

    const notifications = this.repository.findByUser(userId, {
      category: category ? normalizeCategory(category) : undefined,
      period: period ? normalizePeriod(period) : undefined,
      level: normalizedLevel,
    });

    return { notifications, count: notifications.length };
  }
}

const defaultService = new NotificationService();

module.exports = defaultService;
module.exports.NotificationService = NotificationService;
