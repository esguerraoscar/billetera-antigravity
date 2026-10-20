const config = require('./config');
const { createNotificationsServer } = require('./http/server');
const logger = require('./utils/logger');

if (require.main === module) {
  const server = createNotificationsServer();
  server.listen(config.port, () => {
    logger.info(`notifications-service escuchando en el puerto ${config.port}`);
  });
}

module.exports = {
  createNotificationsServer,
};
