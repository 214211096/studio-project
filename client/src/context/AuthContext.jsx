import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    () =>
      api('/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => setUser(null)),
    []
  );

  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      isAdmin: user?.role === 'admin',
      async loginWithEmail(email, password) {
        const data = await api('/auth/login', { method: 'POST', body: { email, password } });
        setUser(data.user);
      },
      async requestOtp(phone) {
        return api('/auth/otp/request', { method: 'POST', body: { phone } });
      },
      async verifyOtp(phone, code) {
        const data = await api('/auth/otp/verify', { method: 'POST', body: { phone, code } });
        setUser(data.user);
      },
      async forgotPassword(email) {
        return api('/auth/password/forgot', { method: 'POST', body: { email } });
      },
      async resetPassword(email, code, password) {
        const data = await api('/auth/password/reset', { method: 'POST', body: { email, code, password } });
        setUser(data.user);
      },
      async logout() {
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        setUser(null);
      },
    }),
    [user, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
