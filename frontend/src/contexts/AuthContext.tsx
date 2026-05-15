import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { authService } from '@/services/auth.service';
import { authEvents } from '@/lib/authEvents';
import { tokenStorage } from '@/lib/tokenStorage';
import type { LoginRequest, RegisterRequest, User } from '@/types/api.types';

type State = { user: User | null; booting: boolean; loading: boolean };
type AuthContextValue = State & { login(data: LoginRequest): Promise<void>; register(data: RegisterRequest): Promise<void>; logout(): Promise<void>; bootstrap(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

function reducer(state: State, patch: Partial<State>) {
  return { ...state, ...patch };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { user: null, booting: true, loading: false });

  const clearSession = useCallback(async () => {
    await tokenStorage.clearTokens();
    dispatch({ user: null, booting: false, loading: false });
  }, []);

  const bootstrap = useCallback(async () => {
    dispatch({ booting: true });
    try {
      const access = await tokenStorage.getAccessToken();
      if (!access) return dispatch({ user: null, booting: false });
      const user = await authService.me();
      dispatch({ user, booting: false });
    } catch {
      await clearSession();
    }
  }, [clearSession]);

  const login = useCallback(async (data: LoginRequest) => {
    dispatch({ loading: true });
    try {
      const response = await authService.login(data);
      await tokenStorage.saveTokens(response.accessToken, response.refreshToken);
      dispatch({ user: response.user, loading: false });
    } catch (error) {
      dispatch({ loading: false });
      throw error;
    }
  }, []);


  const register = useCallback(async (data: RegisterRequest) => {
    dispatch({ loading: true });
    try {
      const response = await authService.register(data);
      await tokenStorage.saveTokens(response.accessToken, response.refreshToken);
      dispatch({ user: response.user, loading: false });
    } catch (error) {
      dispatch({ loading: false });
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    dispatch({ loading: true });
    try { await authService.logout(); } finally { await clearSession(); }
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
    return authEvents.onForceLogout(clearSession);
  }, [bootstrap, clearSession]);

  const value = useMemo(() => ({ ...state, login, register, logout, bootstrap }), [state, login, register, logout, bootstrap]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
