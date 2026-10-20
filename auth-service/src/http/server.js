const http = require('node:http');
const defaultAuthService = require('../services/authService');
const sessionValidator = require('../session/sessionValidator');
const logger = require('../utils/logger');

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        if (typeof req.destroy === 'function') req.destroy();
        const err = new Error('Payload demasiado grande.');
        err.statusCode = 413;
        reject(err);
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error('El cuerpo de la solicitud no es un JSON válido.');
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on('error', reject);\n  });
}

function createRequestHandler(authService = defaultAuthService) {
  return async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      return res.end();
    }

    try {
      if (method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, { status: 'ok', service: 'auth-service' });
      }

      if (method === 'POST' && pathname === '/auth/register') {
        const body = await parseJsonBody(req);
        const result = await authService.register({
          email: body.email,
          password: body.password,
          name: body.name,
        });
        return sendJson(res, 201, result);
      }

      if (method === 'POST' && pathname === '/auth/login') {
        const body = await parseJsonBody(req);
        const result = await authService.login({
          email: body.email,
          password: body.password,
        });
        return sendJson(res, 200, result);
      }

      if ((method === 'POST' || method === 'GET') && pathname === '/auth/verify') {
        const body = method === 'POST' ? await parseJsonBody(req) : {};
        const tokenSource = req.headers?.authorization || body.token;
        const result = authService.verifySession(tokenSource);
        return sendJson(res, 200, result);
      }

      if (method === 'GET' && pathname === '/auth/me') {
        // Validación centralizada de sesión desde sessionValidator
        const validation = sessionValidator.validateRequestSession(req);
        if (!validation.valid) {
          return sendJson(res, 401, { error: validation.reason });
        }
        const verified = authService.verifySession(req.headers?.authorization);
        return sendJson(res, 200, { user: verified.user, session: verified.session });
      }

      if (method === 'POST' && pathname === '/auth/logout') {
        const body = await parseJsonBody(req);
        const tokenSource = req.headers?.authorization || body.token;
        const result = authService.logout(tokenSource);
        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: 'Ruta no encontrada.' });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        logger.error('Error interno en auth-service', { message: error.message });
      }
      return sendJson(res, statusCode, {
        error: error.message || 'Error interno del servidor.',
      });
    }
  };
}

function createAuthServer(authService = defaultAuthService) {
  return http.createServer(createRequestHandler(authService));
}

module.exports = {
  createAuthServer,
  createRequestHandler,
};
