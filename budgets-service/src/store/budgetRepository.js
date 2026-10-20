const crypto = require('node:crypto');

/**
 * Repositorio en memoria de presupuestos (mismo enfoque que transactionRepository
 * y userRepository). Reemplazable por una base de datos sin tocar el servicio.
 */
class BudgetRepository {
  constructor() {
    this.budgets = new Map();
  }

  create({ userId, category, limitAmount, period }) {
    const budget = {
      id: crypto.randomUUID(),
      userId,
      category,
      limitAmount,
      period,
      createdAt: new Date().toISOString(),
    };
    this.budgets.set(budget.id, budget);
    return { ...budget };
  }

  /**
   * Lista los presupuestos de un usuario, del más reciente al más antiguo.
   * @param {string} userId
   * @param {{ category?: string, period?: string }} filters
   */
  findByUser(userId, { category, period } = {}) {
    return [...this.budgets.values()]
      .filter((b) => b.userId === userId)
      .filter((b) => !category || b.category === category)
      .filter((b) => !period || b.period === period)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((b) => ({ ...b }));
  }

  clear() {
    this.budgets.clear();
  }
}

const defaultRepository = new BudgetRepository();

module.exports = defaultRepository;
module.exports.BudgetRepository = BudgetRepository;
