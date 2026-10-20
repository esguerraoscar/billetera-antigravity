const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

export async function requestJson(baseUrl, endpoint, options = {}) {
  const token = window.sessionStorage.getItem('billetera_token');
  const headers = {
    ...DEFAULT_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Error HTTP ${response.status} al consultar ${endpoint}`);
  }

  return response.json();
}
