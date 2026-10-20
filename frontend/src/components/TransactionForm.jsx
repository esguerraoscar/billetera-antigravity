import { Card } from './ui/Card.jsx';
import { Input } from './ui/Input.jsx';
import { Button } from './ui/Button.jsx';

export function TransactionForm({
  formData,
  isSubmitting,
  error,
  onFieldChange,
  onSubmit,
}) {
  return (
    <Card title="Registrar nuevo gasto">
      <form className="ui-form" onSubmit={onSubmit}>
        {error && (
          <div className="ui-alert-error" role="alert">
            {error}
          </div>
        )}

        <Input
          id="transaction-amount"
          name="amount"
          type="number"
          label="Monto ($)"
          placeholder="50000"
          value={formData.amount}
          required
          onChange={onFieldChange}
        />

        <Input
          id="transaction-category"
          name="category"
          type="text"
          label="Categoría"
          placeholder="Comida"
          value={formData.category}
          required
          onChange={onFieldChange}
        />

        <Input
          id="transaction-date"
          name="date"
          type="date"
          label="Fecha"
          value={formData.date}
          required
          onChange={onFieldChange}
        />

        <Input
          id="transaction-description"
          name="description"
          type="text"
          label="Descripción"
          placeholder="Almuerzo o mercado"
          value={formData.description}
          onChange={onFieldChange}
        />

        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando gasto...' : 'Registrar gasto'}
        </Button>
      </form>
    </Card>
  );
}
