const crypto = require('node:crypto');

/**
 * Repositorio en memoria de transacciones (mismo enfoque que userRepository
 * en auth-service). Reemplazable por una base de datos sin tocar el servicio.
 */
class TransactionRepository {
  constructor() {
    this.transactions = new Map();
  }

  create({ userId, amount, category, date, description }) {
    const transaction = {
      id: crypto.randomUUID(),
      userId,
      amount,
      category,
      date,
      description,
      createdAt: new Date().toISOString(),
    };
    this.transactions.set(transaction.id, transaction);
    return { ...transaction };
  }

  /**
   * Lista las transacciones de un usuario, de la más reciente a la más antigua.
   * @param {string} userId
   * @param {{ category?: string, from?: string, to?: string }} filters
   */
  findByUser(userId, { category, from, to } = {}) {
    return [...this.transactions.values()]
      .filter((t) => t.userId === userId)
      .filter((t) => !category || t.category === category)
      .filter((t) => !from || t.date >= from)
      .filter((t) => !to || t.date <= to)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .map((t) => ({ ...t }));
  }

  clear() {
    this.transactions.clear();
  }
}

const defaultRepository = new TransactionRepository();

module.exports = defaultRepository;
module.exports.TransactionRepository = TransactionRepository;
