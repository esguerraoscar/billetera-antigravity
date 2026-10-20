import { requestJson } from './ApiClient.js';

const TRANSACTIONS_SERVICE_URL =
  import.meta.env?.VITE_TRANSACTIONS_SERVICE_URL || 'http://localhost:4002';

export async function fetchTransactions() {
  try {
    const data = await requestJson(TRANSACTIONS_SERVICE_URL, '/transactions', {
      method: 'GET',
    });
    return Array.isArray(data?.transactions) ? data.transactions : [];
  } catch {
    // Fallback del scaffold inicial: retorna listado vacío de transacciones cuando transactions-service no está activo
    return [];
  }
}

export async function createTransaction({ amount, category, date, description }) {
  const numericAmount = Number(String(amount).replace(/\./g, '').replace(',', '.'));
  const data = await requestJson(TRANSACTIONS_SERVICE_URL, '/transactions', {
    method: 'POST',
    body: JSON.stringify({
      amount: numericAmount,
      category,
      date,
      description: description || undefined,
    }),
  });
  return data?.transaction;
}
