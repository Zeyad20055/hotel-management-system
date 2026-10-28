import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
const ANON = { status: 'anon', user: null, settings: null };

async function fetchSettings() {
  try { return (await api.get('/settings')).data.data; } catch { return null; }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, settings: null });

  const refresh = useCallback(async () => {
    try {
      const user = (await api.get('/auth/me')).data.data;
      setState({ status: 'authed', user, settings: user.mustChangePassword ? null : await fetchSettings() });
    } catch (e) {
      setState(e.response?.status === 401 ? ANON : { status: 'offline', user: null, settings: null });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const expired = () => setState(ANON);
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, []);

  const value = useMemo(() => ({
    ...state,
    refresh,
    login: async (email, password) => {
      const user = (await api.post('/auth/login', { email, password })).data.data;
      setState({ status: 'authed', user, settings: user.mustChangePassword ? null : await fetchSettings() });
      return user;
    },
    logout: async () => { try { await api.post('/auth/logout'); } catch { /* cookie may already be gone */ } setState(ANON); },
    can: (...roles) => !!state.user && roles.includes(state.user.role),
    reloadSettings: async () => { const settings = await fetchSettings(); setState((p) => ({ ...p, settings })); },
  }), [state, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
