const config = {
  port: Number(process.env.PORT) || 4004,
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  transactionsServiceUrl: process.env.TRANSACTIONS_SERVICE_URL || 'http://localhost:4002',
  budgetsServiceUrl: process.env.BUDGETS_SERVICE_URL || 'http://localhost:4003',
  authTimeoutMs: Number(process.env.AUTH_TIMEOUT_MS) || 3000,
  serviceTimeoutMs: Number(process.env.SERVICE_TIMEOUT_MS) || 3000,
  warningThreshold: Number(process.env.WARNING_THRESHOLD) || 0.8,
};

module.exports = config;
