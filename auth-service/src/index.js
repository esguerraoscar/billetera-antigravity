const config = require('./config');
const { createAuthServer } = require('./http/server');
const logger = require('./utils/logger');

if (require.main === module) {
  const server = createAuthServer();
  server.listen(config.port, () => {
    logger.info(`auth-service escuchando en el puerto ${config.port}`);
  });
}

module.exports = {
  createAuthServer,
};
