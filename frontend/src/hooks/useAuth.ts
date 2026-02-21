import { useState } from 'react';

const TOKEN_KEY = 'invoiceflow_token';

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  function setToken(newToken: string | null) {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(newToken);
  }

  function logout() {
    setToken(null);
  }

  return { token, setToken, logout };
}
