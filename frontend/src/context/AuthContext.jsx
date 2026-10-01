import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);
const TOKEN_KEY = 'teamboard_token';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    api.me(token)
      .then(({ user }) => setSession({ token, user: normalizeUser(user) }))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const setSessionFromResult = useCallback(result => {
    localStorage.setItem(TOKEN_KEY, result.token);
    setSession({ token: result.token, user: normalizeUser(result.user) });
  }, []);

  const signIn = useCallback(async values => setSessionFromResult(await api.login(values)), [setSessionFromResult]);
  const register = useCallback(async values => setSessionFromResult(await api.register(values)), [setSessionFromResult]);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, loading, signIn, register, signOut }), [session, loading, signIn, register, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function normalizeUser(user) {
  return { ...user, id: user.id || user._id };
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
