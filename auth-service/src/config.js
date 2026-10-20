const crypto = require('node:crypto');

const config = {
  port: Number(process.env.PORT) || 4001,
  jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
  jwtExpiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 3600,
  jwtIssuer: 'billetera-auth-service',
  scryptParams: {
    N: 16384,
    r: 8,
    p: 1,
    keylen: 64,
    saltBytes: 16,
  },
};

module.exports = config;
