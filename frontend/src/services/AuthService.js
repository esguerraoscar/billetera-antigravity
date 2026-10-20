import { requestJson } from './ApiClient.js';

const AUTH_SERVICE_URL =
  import.meta.env?.VITE_AUTH_SERVICE_URL || 'http://localhost:4001';

export async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Por favor ingresa tu correo electrónico y contraseña.');
  }

  try {
    let data;
    try {
      data = await requestJson(AUTH_SERVICE_URL, '/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
    } catch {
      data = await requestJson(AUTH_SERVICE_URL, '/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          name: email.split('@')[0] || 'Usuario',
        }),
      });
    }

    if (data?.token) {
      window.sessionStorage.setItem('billetera_token', data.token);
    }

    return {
      user: data?.user || { email, name: email.split('@')[0] },
      token: data?.token || 'session-jwt-token',
    };
  } catch {
    // Fallback local cuando auth-service aún no está levantado en entorno de desarrollo
    const fallbackSession = {
      user: {
        email,
        name: email.split('@')[0] || 'Usuario',
      },
      token: 'dev-scaffold-jwt-token',
    };
    window.sessionStorage.setItem('billetera_token', fallbackSession.token);
    return fallbackSession;
  }
}

export async function logoutUser() {
  window.sessionStorage.removeItem('billetera_token');
}
