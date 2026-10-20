const { hashPassword, verifyPassword } = require('../security/passwordHasher');
const sessionValidator = require('../session/sessionValidator');
const defaultUserRepository = require('../store/userRepository');
const logger = require('../utils/logger');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

class AuthService {
  constructor(userRepository = defaultUserRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Registra un nuevo usuario, hashea su contraseña y emite su sesión inicial.
   */
  async register({ email, password, name }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const trimmedName = String(name || '').trim();

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      throw createHttpError(400, 'Debe proporcionar un correo electrónico válido.');
    }

    if (!trimmedName) {
      throw createHttpError(400, 'El nombre del usuario es obligatorio.');
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw createHttpError(400, 'La contraseña debe tener al menos 8 caracteres.');
    }

    const existing = this.userRepository.findByEmail(normalizedEmail);
    if (existing) {
      logger.warn('Intento de registro con correo duplicado', { email: normalizedEmail });
      throw createHttpError(409, 'El correo electrónico ya está registrado.');
    }

    const passwordHash = await hashPassword(password);
    const publicUser = this.userRepository.create({
      email: normalizedEmail,
      name: trimmedName,
      passwordHash,
    });

    const { token, expiresAt } = sessionValidator.issueSessionToken(publicUser);

    // Nunca se loguean contraseñas ni tokens en texto plano (AGENTS.md)
    logger.info('Usuario registrado exitosamente', {
      userId: publicUser.id,
      email: publicUser.email,
    });

    return {
      user: publicUser,
      token,
      expiresAt,
    };
  }

  /**
   * Inicia sesión verificando credenciales y emite un token JWT.
   */
  async login({ email, password }) {
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || typeof password !== 'string' || !password) {
      throw createHttpError(400, 'Correo electrónico y contraseña requeridos.');
    }

    const storedUser = this.userRepository.findByEmail(normalizedEmail);
    if (!storedUser) {
      logger.warn('Intento de inicio de sesión fallido: usuario no encontrado', {
        email: normalizedEmail,
      });
      throw createHttpError(401, 'Credenciales inválidas.');
    }

    const passwordMatches = await verifyPassword(password, storedUser.passwordHash);
    if (!passwordMatches) {
      logger.warn('Intento de inicio de sesión fallido: contraseña incorrecta', {
        userId: storedUser.id,
        email: normalizedEmail,
      });
      throw createHttpError(401, 'Credenciales inválidas.');
    }

    const publicUser = this.userRepository.toPublicUser(storedUser);
    const { token, expiresAt } = sessionValidator.issueSessionToken(publicUser);

    logger.info('Inicio de sesión exitoso', {
      userId: publicUser.id,
      email: publicUser.email,
    });

    return {
      user: publicUser,
      token,
      expiresAt,
    };
  }

  /**
   * Verifica la sesión delegando exclusivamente en el módulo central sessionValidator.
   */
  verifySession(tokenOrHeader) {
    const validation = sessionValidator.validateSession(tokenOrHeader);
    if (!validation.valid) {
      throw createHttpError(401, validation.reason || 'Sesión inválida.');
    }

    const user = this.userRepository.findById(validation.session.userId);
    if (!user) {
      throw createHttpError(401, 'El usuario asociado a la sesión ya no existe.');
    }

    return {
      valid: true,
      session: validation.session,
      user: this.userRepository.toPublicUser(user),
    };
  }

  /**
   * Cierra y revoca la sesión actual a través del módulo central.
   */
  logout(tokenOrHeader) {
    const result = sessionValidator.revokeSession(tokenOrHeader);
    if (!result.revoked) {
      throw createHttpError(401, result.reason || 'No se pudo revocar la sesión.');
    }
    return { revoked: true };
  }
}

module.exports = new AuthService();
module.exports.AuthService = AuthService;
