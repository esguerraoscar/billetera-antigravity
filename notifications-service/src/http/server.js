const http = require('node:http');
const defaultNotificationService = require('../services/notificationService');
const defaultAuthClient = require('../auth/authClient');
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
    req.on('error', reject);
  });
}

function createRequestHandler(
  notificationService = defaultNotificationService,
  authClient = defaultAuthClient
) {
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
        return sendJson(res, 200, { status: 'ok', service: 'notifications-service' });
      }

      if (
        (pathname === '/notifications' && (method === 'GET' || method === 'POST')) ||
        (pathname === '/notifications/evaluate' && method === 'POST')
      ) {
        const authorization = req.headers?.authorization;
        const session = await authClient.verifySession(authorization);
        if (!session.valid) {
          return sendJson(res, 401, { error: session.reason });
        }

        if (method === 'POST') {
          const body = await parseJsonBody(req);
          const result = await notificationService.evaluateTransaction(
            session.userId,
            body,
            authorization
          );
          const statusCode = result.alertGenerated ? 201 : 200;
          return sendJson(res, statusCode, result);
        }

        const result = notificationService.list(session.userId, {
          category: url.searchParams.get('category') || undefined,
          period: url.searchParams.get('period') || undefined,
          level: url.searchParams.get('level') || undefined,
        });
        return sendJson(res, 200, result);
      }

      return sendJson(res, 404, { error: 'Ruta no encontrada.' });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      if (statusCode >= 500) {
        logger.error('Error interno en notifications-service', { message: error.message });
      }
      return sendJson(res, statusCode, {
        error: error.message || 'Error interno del servidor.',
      });
    }
  };
}

function createNotificationsServer(notificationService, authClient) {
  return http.createServer(createRequestHandler(notificationService, authClient));
}

module.exports = {
  createNotificationsServer,
  createRequestHandler,
};
