const config = require('./config');
const { createBudgetsServer } = require('./http/server');
const logger = require('./utils/logger');

if (require.main === module) {
  const server = createBudgetsServer();
  server.listen(config.port, () => {
    logger.info(`budgets-service escuchando en el puerto ${config.port}`);
  });
}

module.exports = {
  createBudgetsServer,
};
