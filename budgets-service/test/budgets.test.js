process.env.NODE_ENV = 'test';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createRequestHandler } = require('../src/http/server');
const { BudgetService } = require('../src/services/budgetService');
const { BudgetRepository } = require('../src/store/budgetRepository');

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

describe('budgets-service', () => {
  let handler;
  const ana = { Authorization: 'Bearer token-ana' };
  const luis = { Authorization: 'Bearer token-luis' };

  beforeEach(() => {
    const service = new BudgetService(new BudgetRepository());
    handler = createRequestHandler(service, fakeAuthClient);
  });

  it('crea un presupuesto con categoría, monto límite y periodo', async () => {
    const res = await invokeHttp(handler, {
      method: 'POST',
      url: '/budgets',
      headers: ana,
      body: { category: ' Comida ', limitAmount: 500.5, period: ' 2026-10 ' },
    });
    assert.equal(res.status, 201);
    const { budget } = res.json();
    assert.equal(budget.category, 'comida');
    assert.equal(budget.limitAmount, 500.5);
    assert.equal(budget.period, '2026-10');
    assert.equal(budget.userId, 'user-ana');
    assert.ok(budget.id);
  });

  it('rechaza datos inválidos con 400', async () => {
    const bodies = [
      { category: 'comida', limitAmount: -10, period: '2026-10' },
      { category: 'comida', limitAmount: 0, period: '2026-10' },
      { category: 'comida', limitAmount: '500', period: '2026-10' },
      { category: '', limitAmount: 500, period: '2026-10' },
      { category: 'comida', limitAmount: 500, period: '' },
      { category: 'comida', limitAmount: 500 },
    ];
    for (const body of bodies) {
      const res = await invokeHttp(handler, { method: 'POST', url: '/budgets', headers: ana, body });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  it('lista con filtros y solo los presupuestos del usuario autenticado', async () => {
    const post = (headers, body) =>
      invokeHttp(handler, { method: 'POST', url: '/budgets', headers, body });
    await post(ana, { category: 'comida', limitAmount: 300, period: '2026-10' });
    await post(ana, { category: 'transporte', limitAmount: 150, period: '2026-11' });
    await post(luis, { category: 'comida', limitAmount: 900, period: '2026-10' });

    const all = (await invokeHttp(handler, { url: '/budgets', headers: ana })).json();
    assert.equal(all.count, 2);

    const byCat = (await invokeHttp(handler, { url: '/budgets?category=Comida', headers: ana })).json();
    assert.equal(byCat.count, 1);
    assert.equal(byCat.budgets[0].category, 'comida');

    const byPeriod = (await invokeHttp(handler, { url: '/budgets?period=2026-11', headers: ana })).json();
    assert.equal(byPeriod.count, 1);
    assert.equal(byPeriod.budgets[0].category, 'transporte');
  });

  it('exige sesión válida (401 sin token o con token inválido)', async () => {
    const noToken = await invokeHttp(handler, { url: '/budgets' });
    assert.equal(noToken.status, 401);
    const badToken = await invokeHttp(handler, {
      method: 'POST',
      url: '/budgets',
      headers: { Authorization: 'Bearer falso' },
      body: { category: 'comida', limitAmount: 100, period: '2026-10' },
    });
    assert.equal(badToken.status, 401);
  });

  it('expone /health y responde 404 en rutas desconocidas', async () => {
    assert.equal((await invokeHttp(handler, { url: '/health' })).status, 200);
    assert.equal((await invokeHttp(handler, { url: '/nada' })).status, 404);
  });
});
