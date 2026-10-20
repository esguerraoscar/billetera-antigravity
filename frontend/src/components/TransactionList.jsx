import { Card } from './ui/Card.jsx';
import { Button } from './ui/Button.jsx';
import { EmptyState } from './ui/EmptyState.jsx';

export function TransactionList({
  transactions,
  hasTransactions,
  isLoading,
  error,
  onReload,
}) {
  const reloadAction = (
    <Button variant="secondary" disabled={isLoading} onClick={onReload}>
      {isLoading ? 'Actualizando...' : 'Actualizar'}
    </Button>
  );

  return (
    <Card title="Transacciones recientes" action={reloadAction}>
      {error && (
        <div className="ui-alert-error" role="alert">
          {error}
        </div>
      )}

      {!hasTransactions ? (
        <EmptyState
          title="No hay transacciones registradas"
          description="Aún no tienes movimientos ni gastos en tu cuenta. Cuando registres tu primera transacción aparecerá listada aquí."
        />
      ) : (
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => {
              const displayCategory = item.category
                ? item.category.charAt(0).toUpperCase() + item.category.slice(1)
                : '';
              const displayAmount = `$${Number(item.amount).toLocaleString('es-CO')}`;

              return (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>{item.description || '—'}</td>
                  <td>{displayCategory}</td>
                  <td>{displayAmount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
