process.env.NODE_ENV = 'test';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createRequestHandler } = require('../src/http/server');
const { NotificationService } = require('../src/services/notificationService');
const { NotificationRepository } = require('../src/store/notificationRepository');

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

describe('notifications-service', () => {
  let handler;
  let budgetsByUser;
  let transactionsByUser;
  const ana = { Authorization: 'Bearer token-ana' };
  const luis = { Authorization: 'Bearer token-luis' };

  beforeEach(() => {
    budgetsByUser = {
      'Bearer token-ana': [
        { id: 'b-comida-1', userId: 'user-ana', category: 'comida', limitAmount: 200, period: '2026-10' },
        { id: 'b-transporte-1', userId: 'user-ana', category: 'transporte', limitAmount: 100, period: 'mensual' },
      ],
      'Bearer token-luis': [
        { id: 'b-luis-1', userId: 'user-luis', category: 'comida', limitAmount: 500, period: '2026-10' },
      ],
    };

    transactionsByUser = {
      'Bearer token-ana': [
        { id: 'tx-1', userId: 'user-ana', amount: 120, category: 'comida', date: '2026-10-05' },
      ],
      'Bearer token-luis': [],
    };

    const fakeBudgetsClient = {
      async listBudgets(authHeader, { category } = {}) {
        const list = budgetsByUser[authHeader] || [];
        return category ? list.filter((b) => b.category === category) : list;
      },
    };

    const fakeTransactionsClient = {
      async listTransactions(authHeader, { category, from, to } = {}) {
        const list = transactionsByUser[authHeader] || [];
        return list
          .filter((tx) => !category || tx.category === category)
          .filter((tx) => !from || tx.date >= from)
          .filter((tx) => !to || tx.date <= to);
      },
    };

    const service = new NotificationService(
      new NotificationRepository(),
      fakeBudgetsClient,
      fakeTransactionsClient,
      { warningThreshold: 0.8 }
    );
    handler = createRequestHandler(service, fakeAuthClient);
  });

  it('genera una alerta warning (>= 80%) al evaluar una nueva transacción', async () => {
    // Ana ya tiene 120 gastados de 200 en comida (2026-10). Con +50 llega a 170 (85%).
    const res = await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: { id: 'tx-2', amount: 50, category: ' Comida ', date: '2026-10-12' },
    });

    assert.equal(res.status, 201);
    const data = res.json();
    assert.equal(data.alertGenerated, true);
    assert.equal(data.spentAmount, 170);
    assert.equal(data.usagePercentage, 85);
    assert.equal(data.notification.level, 'warning');
    assert.equal(data.notification.category, 'comida');
    assert.equal(data.notification.period, '2026-10');
    assert.equal(data.notification.userId, 'user-ana');
    assert.equal(data.notification.transactionId, 'tx-2');
  });

  it('genera una alerta exceeded (> 100%) cuando el gasto supera el presupuesto', async () => {
    // Ana ya tiene 120 gastados de 200. Con +100 llega a 220 (110%).
    const res = await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: {
        transaction: { id: 'tx-3', amount: 100, category: 'comida', date: '2026-10-18' },
      },
    });

    assert.equal(res.status, 201);
    const data = res.json();
    assert.equal(data.alertGenerated, true);
    assert.equal(data.spentAmount, 220);
    assert.equal(data.usagePercentage, 110);
    assert.equal(data.notification.level, 'exceeded');
    assert.equal(data.notification.limitAmount, 200);
  });

  it('no duplica el monto si la transacción ya fue registrada en transactions-service', async () => {
    transactionsByUser['Bearer token-ana'].push({
      id: 'tx-existing',
      userId: 'user-ana',
      amount: 90,
      category: 'comida',
      date: '2026-10-19',
    });

    const res = await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: { id: 'tx-existing', amount: 90, category: 'comida', date: '2026-10-19' },
    });

    assert.equal(res.status, 201);
    const data = res.json();
    assert.equal(data.spentAmount, 210); // 120 + 90 (sin sumar 90 dos veces)
    assert.equal(data.notification.level, 'exceeded');
  });

  it('responde 200 sin generar alerta si el gasto está bajo el umbral o no hay presupuesto', async () => {
    // Bajo el 80%: 120 + 20 = 140 / 200 (70%)
    const below = await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: { amount: 20, category: 'comida', date: '2026-10-10' },
    });
    assert.equal(below.status, 200);
    assert.equal(below.json().alertGenerated, false);
    assert.equal(below.json().notification, null);

    // Categoría sin presupuesto configurado
    const noBudget = await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: { amount: 500, category: 'ocio', date: '2026-10-10' },
    });
    assert.equal(noBudget.status, 200);
    assert.equal(noBudget.json().alertGenerated, false);
  });

  it('rechaza datos inválidos con 400', async () => {
    const bodies = [
      { amount: -10, category: 'comida', date: '2026-10-15' },
      { amount: 0, category: 'comida', date: '2026-10-15' },
      { amount: '50', category: 'comida', date: '2026-10-15' },
      { amount: 50, category: '', date: '2026-10-15' },
      { amount: 50, category: 'comida', date: '2026-02-30' },
      { amount: 50, category: 'comida' },
    ];
    for (const body of bodies) {
      const res = await invokeHttp(handler, {
        method: 'POST',
        url: '/notifications/evaluate',
        headers: ana,
        body,
      });
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  it('lista con filtros y solo las alertas del usuario autenticado', async () => {
    await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: { amount: 50, category: 'comida', date: '2026-10-12' }, // warning (170/200)
    });
    await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: ana,
      body: { amount: 110, category: 'transporte', date: '2026-10-15' }, // exceeded (110/100)
    });
    await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: luis,
      body: { amount: 600, category: 'comida', date: '2026-10-15' }, // exceeded para Luis
    });

    const allAna = (await invokeHttp(handler, { url: '/notifications', headers: ana })).json();
    assert.equal(allAna.count, 2);

    const byLevel = (
      await invokeHttp(handler, { url: '/notifications?level=exceeded', headers: ana })
    ).json();
    assert.equal(byLevel.count, 1);
    assert.equal(byLevel.notifications[0].category, 'transporte');

    const byCat = (
      await invokeHttp(handler, { url: '/notifications?category=Comida', headers: ana })
    ).json();
    assert.equal(byCat.count, 1);
    assert.equal(byCat.notifications[0].level, 'warning');

    const badLevel = await invokeHttp(handler, {
      url: '/notifications?level=invalido',
      headers: ana,
    });
    assert.equal(badLevel.status, 400);
  });

  it('exige sesión válida (401 sin token o con token inválido)', async () => {
    const noToken = await invokeHttp(handler, { url: '/notifications' });
    assert.equal(noToken.status, 401);

    const badToken = await invokeHttp(handler, {
      method: 'POST',
      url: '/notifications/evaluate',
      headers: { Authorization: 'Bearer falso' },
      body: { amount: 50, category: 'comida', date: '2026-10-10' },
    });
    assert.equal(badToken.status, 401);
  });

  it('expone /health y responde 404 en rutas desconocidas', async () => {
    assert.equal((await invokeHttp(handler, { url: '/health' })).status, 200);
    assert.equal((await invokeHttp(handler, { url: '/nada' })).status, 404);
  });
});
