const crypto = require('node:crypto');

class UserRepository {
  constructor() {
    this.usersById = new Map();
    this.usersByEmail = new Map();
  }

  normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  findByEmail(email) {
    const normalized = this.normalizeEmail(email);
    return this.usersByEmail.get(normalized) || null;
  }

  findById(id) {
    return this.usersById.get(id) || null;
  }

  create({ email, name, passwordHash }) {
    const normalizedEmail = this.normalizeEmail(email);
    if (this.usersByEmail.has(normalizedEmail)) {
      const error = new Error('El correo electrónico ya está registrado.');
      error.statusCode = 409;
      throw error;
    }

    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      name: String(name || '').trim(),
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    this.usersById.set(user.id, user);
    this.usersByEmail.set(normalizedEmail, user);
    return this.toPublicUser(user);
  }

  toPublicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  clear() {
    this.usersById.clear();
    this.usersByEmail.clear();
  }
}

module.exports = new UserRepository();
module.exports.UserRepository = UserRepository;
