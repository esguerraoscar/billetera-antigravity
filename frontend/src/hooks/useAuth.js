import { useState, useCallback } from 'react';
import { loginUser, logoutUser } from '../services/AuthService.js';

const INITIAL_CREDENTIALS = {
  email: '',
  password: '',
};

export function useAuth() {
  const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFieldChange = useCallback((event) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  }, []);

  const handleLoginSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setIsLoading(true);
      setError(null);

      try {
        const session = await loginUser(credentials);
        setUser(session.user);
        setToken(session.token);
      } catch (err) {
        setError(err.message || 'No fue posible iniciar sesión.');
      } finally {
        setIsLoading(false);
      }
    },
    [credentials]
  );

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setUser(null);
    setToken(null);
    setCredentials(INITIAL_CREDENTIALS);
    setError(null);
  }, []);

  return {
    credentials,
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    error,
    handleFieldChange,
    handleLoginSubmit,
    handleLogout,
  };
}
