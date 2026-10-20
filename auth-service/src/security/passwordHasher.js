/**
 * Módulo de hashing de contraseñas.
 *
 * Justificación documentada en el plan (AGENTS.md):
 * - Algoritmo: scrypt (RFC 7914) vía node:crypto (N=16384, r=8, p=1, keylen=64 bytes).
 * - Salt único de 16 bytes generado con CSPRNG (crypto.randomBytes).
 * - Verificación en tiempo constante mediante crypto.timingSafeEqual para mitigar timing attacks.
 */

const crypto = require('node:crypto');
const config = require('../config');

const { N, r, p, keylen, saltBytes } = config.scryptParams;

/**
 * Genera el hash seguro de una contraseña en formato:
 * scrypt$<N>$<r>$<p>$<saltHex>$<derivedKeyHex>
 *
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
function hashPassword(plainPassword) {
  return new Promise((resolve, reject) => {
    if (typeof plainPassword !== 'string' || plainPassword.length < 8) {
      return reject(new Error('La contraseña debe tener al menos 8 caracteres.'));
    }

    const salt = crypto.randomBytes(saltBytes);
    crypto.scrypt(plainPassword, salt, keylen, { N, r, p }, (err, derivedKey) => {
      if (err) return reject(err);
      const formatted = `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
      resolve(formatted);
    });
  });
}

/**
 * Verifica una contraseña en texto plano contra un hash almacenado en tiempo constante.
 *
 * @param {string} plainPassword
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
function verifyPassword(plainPassword, storedHash) {
  return new Promise((resolve, reject) => {
    if (typeof plainPassword !== 'string' || typeof storedHash !== 'string') {
      return resolve(false);
    }

    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return resolve(false);
    }

    const costN = Number(parts[1]);
    const blockR = Number(parts[2]);
    const parallelP = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'hex');
    const expectedKey = Buffer.from(parts[5], 'hex');

    if (!costN || !blockR || !parallelP || salt.length === 0 || expectedKey.length === 0) {
      return resolve(false);
    }

    crypto.scrypt(
      plainPassword,
      salt,
      expectedKey.length,
      { N: costN, r: blockR, p: parallelP },
      (err, derivedKey) => {
        if (err) return reject(err);
        if (derivedKey.length !== expectedKey.length) {
          return resolve(false);
        }
        const isMatch = crypto.timingSafeEqual(derivedKey, expectedKey);
        resolve(isMatch);
      }
    );
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
};
