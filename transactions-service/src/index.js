const config = require('./config');
const { createTransactionsServer } = require('./http/server');
const logger = require('./utils/logger');

if (require.main === module) {
  const server = createTransactionsServer();
  server.listen(config.port, () => {
    logger.info(`transactions-service escuchando en el puerto ${config.port}`);
  });
}

module.exports = {
  createTransactionsServer,
};
