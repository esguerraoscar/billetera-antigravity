process.env.NODE_ENV = 'test';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { createRequestHandler } = require('../src/http/server');
const { AuthService } = require('../src/services/authService');
const { UserRepository } = require('../src/store/userRepository');
const { hashPassword, verifyPassword } = require('../src/security/passwordHasher');
const sessionValidator = require('../src/session/sessionValidator');
const logger = require('../src/utils/logger');

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
    let responseHeaders = {};
    let responseBody = '';

    const res = {
      writeHead(code, hdrs = {}) {
        statusCode = code;
        responseHeaders = { ...hdrs };
      },
      end(chunk = '') {
        responseBody += chunk;
        resolve({
          status: statusCode,
          headers: responseHeaders,
          json: () => JSON.parse(responseBody || '{}'),
        });
      },
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

describe('auth-service - Estructura base de autenticación y reglas de AGENTS.md', () => {
  let userRepository;
  let authService;
  let handler;

  beforeEach(() => {
    userRepository = new UserRepository();
    authService = new AuthService(userRepository);
    handler = createRequestHandler(authService);
  });

  it('1. Registra un usuario nuevo, hashea su contraseña con scrypt y emite un JWT válido', async () => {
    const response = await invokeHttp(handler, {
      method: 'POST',
      url: '/auth/register',
      body: {
        email: 'Ana@Ejemplo.com',
        password: 'SuperSecretPassword123!',
        name: 'Ana Pérez',
      },
    });

    assert.equal(response.status, 201);
    const data = response.json();

    assert.equal(data.user.email, 'ana@ejemplo.com');
    assert.equal(data.user.name, 'Ana Pérez');
    assert.equal(data.user.password, undefined);
    assert.equal(data.user.passwordHash, undefined);
    assert.ok(typeof data.token === 'string' && data.token.split('.').length === 3);

    // Verificar que en el repositorio el hash usa scrypt con salt aleatorio
    const storedUser = userRepository.findByEmail('ana@ejemplo.com');
    assert.ok(storedUser.passwordHash.startsWith('scrypt$16384$8$1$'));
    assert.notEqual(storedUser.passwordHash, 'SuperSecretPassword123!');
  });

  it('2. Permite iniciar sesión con credenciales válidas y rechaza contraseñas incorrectas', async () => {
    await authService.register({
      email: 'carlos@billetera.app',
      password: 'MiClaveSegura99',
      name: 'Carlos Ruiz',
    });

    // Login exitoso
    const okRes = await invokeHttp(handler, {
      method: 'POST',
      url: '/auth/login',
      body: {
        email: 'carlos@billetera.app',
        password: 'MiClaveSegura99',
      },
    });
    assert.equal(okRes.status, 200);
    const okData = okRes.json();
    assert.ok(okData.token);
    assert.equal(okData.user.email, 'carlos@billetera.app');

    // Login fallido
    const badRes = await invokeHttp(handler, {
      method: 'POST',
      url: '/auth/login',
      body: {
        email: 'carlos@billetera.app',
        password: 'ClaveIncorrecta99',
      },
    });
    assert.equal(badRes.status, 401);
  });

  it('3. Verifica la sesión y revoca tokens exclusivamente a través del módulo central sessionValidator', async () => {
    const { token, user } = await authService.register({
      email: 'laura@billetera.app',
      password: 'PasswordFuerte2026',
      name: 'Laura Gómez',
    });

    // Verificación por cabecera Authorization: Bearer <token>
    const verifyRes = await invokeHttp(handler, {
      method: 'GET',
      url: '/auth/verify',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(verifyRes.status, 200);
    const verifyData = verifyRes.json();
    assert.equal(verifyData.valid, true);
    assert.equal(verifyData.user.id, user.id);

    // Acceso a /auth/me
    const meRes = await invokeHttp(handler, {
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.status, 200);

    // Logout (revocación en el módulo central)
    const logoutRes = await invokeHttp(handler, {
      method: 'POST',
      url: '/auth/logout',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(logoutRes.status, 200);

    // El mismo token ya no debe ser válido tras ser revocado
    const afterLogoutRes = await invokeHttp(handler, {
      method: 'GET',
      url: '/auth/verify',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(afterLogoutRes.status, 401);
  });

  it('4. Cumple AGENTS.md: Nunca loguea credenciales ni tokens JWT en texto plano', async () => {
    const { token } = await authService.register({
      email: 'seguridad@billetera.app',
      password: 'SecretoCritico123',
      name: 'Auditor',
    });

    const logEntry = logger.info(`Solicitud con Bearer ${token}`, {
      email: 'seguridad@billetera.app',
      password: 'SecretoCritico123',
      token,
      nested: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.ok(!logEntry.includes('SecretoCritico123'), 'La contraseña nunca debe aparecer en logs');
    assert.ok(!logEntry.includes(token), 'El token JWT nunca debe aparecer en texto plano en logs');
    assert.ok(logEntry.includes('[REDACTED]'), 'Debe enmascarar campos sensibles');
  });

  it('5. El módulo passwordHasher genera salts distintos para la misma contraseña y verifica con timingSafeEqual', async () => {
    const hash1 = await hashPassword('MismaPassword123');
    const hash2 = await hashPassword('MismaPassword123');

    assert.notEqual(hash1, hash2, 'Dos hashes de la misma contraseña deben diferir por su salt aleatorio');
    assert.equal(await verifyPassword('MismaPassword123', hash1), true);
    assert.equal(await verifyPassword('MismaPassword123', hash2), true);
    assert.equal(await verifyPassword('OtraPassword123', hash1), false);
  });

  it('6. Rechaza tokens manipulados o firmados con otro secreto en el módulo central', () => {
    const { token } = sessionValidator.issueSessionToken({
      id: 'u-1',
      email: 'test@billetera.app',
      name: 'Test',
    });

    const tamperedToken = `${token.slice(0, -4)}aaaa`;
    const validation = sessionValidator.validateSession(tamperedToken);
    assert.equal(validation.valid, false);
    assert.equal(validation.reason, 'Firma de sesión inválida.');
  });
});
