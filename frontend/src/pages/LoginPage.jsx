import { Card } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Button } from '../components/ui/Button.jsx';

export function LoginPage({
  credentials,
  isLoading,
  error,
  onFieldChange,
  onLoginSubmit,
}) {
  return (
    <main className="login-layout">
      <div className="login-card">
        <div className="brand-header">
          <span className="brand-badge">Billetera</span>
          <h1 className="brand-title">Iniciar sesión</h1>
          <p className="brand-subtitle">
            Controla tus gastos, presupuestos y alertas financieras en un solo lugar.
          </p>
        </div>

        <Card>
          <form className="ui-form" onSubmit={onLoginSubmit}>
            {error && (
              <div className="ui-alert-error" role="alert">
                {error}
              </div>
            )}

            <Input
              id="login-email"
              name="email"
              type="email"
              label="Correo electrónico"
              placeholder="usuario@billetera.app"
              value={credentials.email}
              required
              autoComplete="email"
              onChange={onFieldChange}
            />

            <Input
              id="login-password"
              name="password"
              type="password"
              label="Contraseña"
              placeholder="••••••••"
              value={credentials.password}
              required
              autoComplete="current-password"
              onChange={onFieldChange}
            />

            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Verificando acceso...' : 'Entrar al Dashboard'}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
