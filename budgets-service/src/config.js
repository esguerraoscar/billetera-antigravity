const config = {
  port: Number(process.env.PORT) || 4003,
  authServiceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  authTimeoutMs: Number(process.env.AUTH_TIMEOUT_MS) || 3000,
};

module.exports = config;
