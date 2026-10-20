import { useTransactions } from '../hooks/useTransactions.js';
import { Button } from '../components/ui/Button.jsx';
import { TransactionForm } from '../components/TransactionForm.jsx';
import { TransactionList } from '../components/TransactionList.jsx';

export function DashboardPage({ user, onLogout }) {
  const {
    transactions,
    hasTransactions,
    isLoading,
    error,
    formData,
    isSubmitting,
    submitError,
    reloadTransactions,
    handleFormFieldChange,
    handleTransactionSubmit,
  } = useTransactions(true);

  return (
    <main className="dashboard-layout">
      <header className="dashboard-topbar">
        <div>
          <span className="brand-badge">Billetera · Dashboard</span>
          <h1 className="brand-title">Resumen de Movimientos</h1>
          <p className="dashboard-user-meta">
            Sesión activa: <strong>{user?.email}</strong>
          </p>
        </div>

        <div className="dashboard-actions">
          <Button variant="secondary" onClick={onLogout}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <TransactionForm
        formData={formData}
        isSubmitting={isSubmitting}
        error={submitError}
        onFieldChange={handleFormFieldChange}
        onSubmit={handleTransactionSubmit}
      />

      <TransactionList
        transactions={transactions}
        hasTransactions={hasTransactions}
        isLoading={isLoading}
        error={error}
        onReload={reloadTransactions}
      />
    </main>
  );
}
