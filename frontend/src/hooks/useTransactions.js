import { useState, useEffect, useCallback } from 'react';
import {
  fetchTransactions,
  createTransaction,
} from '../services/TransactionsService.js';

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

const INITIAL_FORM = {
  amount: '',
  category: '',
  date: getTodayIsoDate(),
  description: '',
};

export function useTransactions(isAuthenticated = true) {
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const reloadTransactions = useCallback(async () => {
    if (!isAuthenticated) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const items = await fetchTransactions();
      setTransactions(items);
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las transacciones.');
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const handleFormFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setSubmitError(null);
  }, []);

  const handleTransactionSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        await createTransaction(formData);
        setFormData({
          ...INITIAL_FORM,
          date: getTodayIsoDate(),
        });
        await reloadTransactions();
      } catch (err) {
        setSubmitError(err.message || 'No se pudo registrar el gasto.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, reloadTransactions]
  );

  useEffect(() => {
    reloadTransactions();
  }, [reloadTransactions]);

  return {
    transactions,
    hasTransactions: transactions.length > 0,
    isLoading,
    error,
    formData,
    isSubmitting,
    submitError,
    reloadTransactions,
    handleFormFieldChange,
    handleTransactionSubmit,
  };
}
