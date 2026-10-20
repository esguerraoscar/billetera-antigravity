import { useAuth } from './hooks/useAuth.js';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';

export function App() {
  const {
    credentials,
    user,
    isAuthenticated,
    isLoading,
    error,
    handleFieldChange,
    handleLoginSubmit,
    handleLogout,
  } = useAuth();

  return (
    <div className="app-shell">
      {isAuthenticated ? (
        <DashboardPage user={user} onLogout={handleLogout} />
      ) : (
        <LoginPage
          credentials={credentials}
          isLoading={isLoading}
          error={error}
          onFieldChange={handleFieldChange}
          onLoginSubmit={handleLoginSubmit}
        />
      )}
    </div>
  );
}
