const crypto = require('node:crypto');

/**
 * Repositorio en memoria de alertas/notificaciones (mismo enfoque que
 * budgetRepository, transactionRepository y userRepository).
 * Reemplazable por una base de datos sin tocar el servicio.
 */
class NotificationRepository {
  constructor() {
    this.notifications = new Map();
  }

  create({
    userId,
    budgetId,
    transactionId,
    category,
    period,
    level,
    message,
    spentAmount,
    limitAmount,
    usagePercentage,
  }) {
    const notification = {
      id: crypto.randomUUID(),
      userId,
      budgetId,
      transactionId,
      category,
      period,
      level,
      message,
      spentAmount,
      limitAmount,
      usagePercentage,
      createdAt: new Date().toISOString(),
    };
    this.notifications.set(notification.id, notification);
    return { ...notification };
  }

  /**
   * Lista las alertas de un usuario, de la más reciente a la más antigua.
   * @param {string} userId
   * @param {{ category?: string, period?: string, level?: string }} filters
   */
  findByUser(userId, { category, period, level } = {}) {
    return [...this.notifications.values()]
      .filter((n) => n.userId === userId)
      .filter((n) => !category || n.category === category)
      .filter((n) => !period || n.period === period)
      .filter((n) => !level || n.level === level)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((n) => ({ ...n }));
  }

  clear() {
    this.notifications.clear();
  }
}

const defaultRepository = new NotificationRepository();

module.exports = defaultRepository;
module.exports.NotificationRepository = NotificationRepository;
