process.env.NODE_ENV = 'test';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createRequestHandler } = require('../src/http/server');
const { TransactionService } = require('../src/services/transactionService');
const { TransactionRepository } = require('../src/store/transactionRepository');

function invokeHttp(handler, { method = 'GET', url = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : '';
    const req = Readable.from(payload ? [Buffer.from(payload)] : []);
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
    );

    let statusCode = 200;
    let responseBody = '';
    const res = {
      writeHead(code) {
        statusCode = code;
      },
      end(chunk = '') {
        responseBody += chunk;
        resolve({ status: statusCode, json: () => JSON.parse(responseBody || '{}') });
      },
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

// Doble de auth-service: "token-ana" -> user-ana, "token-luis" -> user-luis
const fakeAuthClient = {
  async verifySession(header) {
    const users = { 'Bearer token-ana': 'user-ana', 'Bearer token-luis': 'user-luis' };
    const userId = users[header];
    return userId
      ? { valid: true, userId }
      : { valid: false, reason: 'Token de sesión no proporcionado.' };
  },
};

describe('transactions-service', () => {
  let handler;
  const ana = { Authorization: 'Bearer token-ana' };
  const luis = { Authorization: 'Bearer token-luis' };

  beforeEach(() => {
    const service = new TransactionService(new TransactionRepository());
    handler = createRequestHandler(service, fakeAuthClient);
  });

  it('crea una transacción con monto, categoría y fecha', async () => {
    const res = await invokeHttp(handler, {
      method: 'POST',
      url: '/transactions',
      headers: ana,
      body: { amount: 25.5, category: ' Comida ', date: '2026-10-15' },
    });
    assert.equal(res.status, 201);
    const { transaction } = res.json();
    assert.equal(transaction.amount, 25.5);
    assert.equal(transaction.category, 'comida');
    assert.equal(transaction.date, '2026-10-15');
    assert.equal(transaction.userId, 'user-ana');
    assert.ok(transaction.id);
  });

  it('rechaza datos inválidos con 400', async () => {
    const bodies = [
      { amount: -5, category: 'comida', date: '2026-10-15' },
      { amount: '10', category: 'comida', date: '2026-10-15' },
      { amount: 10, category: '', date: '2026-10-15' },
      { amount: 10, category: 'comida', date: '2026-02-31' },
      { amount: 10, category: 'comida' },
    ];
    for (const body of bodies) {
      const res = await invokeHttp(handler, { method: 'POST', url: '/transactions', headers: ana, body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  it('lista con filtros y solo las transacciones del usuario autenticado', async () => {
    const post = (headers, body) =>
      invokeHttp(handler, { method: 'POST', url: '/transactions', headers, body });
    await post(ana, { amount: 10, category: 'comida', date: '2026-10-01' });
    await post(ana, { amount: 20, category: 'transporte', date: '2026-10-10' });
    await post(luis, { amount: 99, category: 'comida', date: '2026-10-05' });

    const all = (await invokeHttp(handler, { url: '/transactions', headers: ana })).json();
    assert.equal(all.count, 2);
    assert.equal(all.transactions[0].date, '2026-10-10'); // más reciente primero

    const byCat = (await invokeHttp(handler, { url: '/transactions?category=Comida', headers: ana })).json();
    assert.equal(byCat.count, 1);

    const byRange = (await invokeHttp(handler, { url: '/transactions?from=2026-10-05', headers: ana })).json();
    assert.equal(byRange.count, 1);

    const bad = await invokeHttp(handler, { url: '/transactions?from=hoy', headers: ana });
    assert.equal(bad.status, 400);
  });

  it('exige sesión válida (401 sin token o con token inválido)', async () => {
    const noToken = await invokeHttp(handler, { url: '/transactions' });
    assert.equal(noToken.status, 401);
    const badToken = await invokeHttp(handler, {
      method: 'POST',
      url: '/transactions',
      headers: { Authorization: 'Bearer falso' },
      body: { amount: 1, category: 'x', date: '2026-10-01' },
    });
    assert.equal(badToken.status, 401);
  });

  it('expone /health y responde 404 en rutas desconocidas', async () => {
    assert.equal((await invokeHttp(handler, { url: '/health' })).status, 200);
    assert.equal((await invokeHttp(handler, { url: '/nada' })).status, 404);
  });
});
