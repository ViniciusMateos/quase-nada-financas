import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { authService } from '@/services/auth.service';
import { authEvents } from '@/lib/authEvents';
import { demoMode } from '@/lib/demoMode';
import { demoStore } from '@/demo/demoStore';
import { DEMO_USER } from '@/demo/demoData';
import { tokenStorage } from '@/lib/tokenStorage';
import {
  getSavedAccounts,
  removeSavedAccount as removeSavedAccountStorage,
  syncSavedAccountToken,
  updateSavedAccount as updateSavedAccountStorage,
  upsertSavedAccount,
  type SavedAccount,
} from '@/lib/savedAccounts';
import type { LoginRequest, RegisterRequest, User } from '@/types/api.types';

type State = { user: User | null; booting: boolean; loading: boolean; isDemo: boolean };
type AuthContextValue = State & {
  savedAccounts: SavedAccount[];
  login(data: LoginRequest): Promise<void>;
  register(data: RegisterRequest): Promise<void>;
  loginWithSavedAccount(account: SavedAccount): Promise<void>;
  removeSavedAccount(email: string): Promise<void>;
  updateSavedAccount(email: string, patch: Partial<Pick<SavedAccount, 'name' | 'color'>>): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  logout(): Promise<void>;
  bootstrap(): Promise<void>;
  /** Entra no modo demonstração com dados fictícios (sem token, sem rede). */
  enterDemo(): void;
  /** Sai do demo e restaura a sessão real (se houver) ou volta pro hub. */
  exitDemo(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

function reducer(state: State, patch: Partial<State>) {
  return { ...state, ...patch };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { user: null, booting: true, loading: false, isDemo: false });
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  const reloadSavedAccounts = useCallback(async () => {
    setSavedAccounts(await getSavedAccounts());
  }, []);

  const clearSession = useCallback(async () => {
    demoMode.set(false);
    await tokenStorage.clearTokens();
    dispatch({ user: null, booting: false, loading: false, isDemo: false });
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

  const enterDemo = useCallback(() => {
    demoStore.reset();
    demoMode.set(true);
    dispatch({ user: DEMO_USER, isDemo: true, booting: false, loading: false });
  }, []);

  const exitDemo = useCallback(async () => {
    demoMode.set(false);
    demoStore.reset();
    dispatch({ isDemo: false });
    // Restaura a sessão real (tokens no SecureStore) ou cai pro hub se não houver.
    await bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (data: LoginRequest) => {
    dispatch({ loading: true });
    try {
      const response = await authService.login(data);
      await tokenStorage.saveTokens(response.accessToken, response.refreshToken);
      await tokenStorage.setActiveEmail(response.user.email);
      await upsertSavedAccount({
        email: response.user.email,
        name: response.user.name ?? null,
        refreshToken: response.refreshToken,
      });
      await reloadSavedAccounts();
      dispatch({ user: response.user, loading: false });
    } catch (error) {
      dispatch({ loading: false });
      throw error;
    }
  }, [reloadSavedAccounts]);

  const register = useCallback(async (data: RegisterRequest) => {
    dispatch({ loading: true });
    try {
      const response = await authService.register(data);
      await tokenStorage.saveTokens(response.accessToken, response.refreshToken);
      await tokenStorage.setActiveEmail(response.user.email);
      await upsertSavedAccount({
        email: response.user.email,
        name: response.user.name ?? null,
        refreshToken: response.refreshToken,
      });
      await reloadSavedAccounts();
      dispatch({ user: response.user, loading: false });
    } catch (error) {
      dispatch({ loading: false });
      throw error;
    }
  }, [reloadSavedAccounts]);

  /**
   * Login rápido por conta salva: troca o refreshToken guardado por novos
   * tokens. Como o backend rotaciona refresh tokens, re-salva o novo.
   * Lança erro se o token expirou/foi revogado (o chamador cai pra senha).
   */
  const loginWithSavedAccount = useCallback(async (account: SavedAccount) => {
    dispatch({ loading: true });
    try {
      const tokens = await authService.refresh(account.refreshToken);
      await tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken);
      // Persiste o token rotacionado na conta salva ANTES de qualquer outra
      // chamada. O refresh acima já "queimou" o token antigo no backend; se algo
      // abaixo (ex.: me()) falhar, a conta salva não pode ficar com o token velho
      // — senão o próximo login rápido dispara a detecção de reuso (403) e cai
      // pra senha pra sempre.
      await tokenStorage.setActiveEmail(account.email);
      await syncSavedAccountToken(account.email, tokens.refreshToken);
      const user = await authService.me();
      await tokenStorage.setActiveEmail(user.email);
      await upsertSavedAccount({
        email: user.email,
        name: user.name ?? account.name,
        refreshToken: tokens.refreshToken,
      });
      await reloadSavedAccounts();
      dispatch({ user, loading: false });
    } catch (error) {
      dispatch({ loading: false });
      throw error;
    }
  }, [reloadSavedAccounts]);

  const removeSavedAccount = useCallback(async (email: string) => {
    await removeSavedAccountStorage(email);
    await reloadSavedAccounts();
  }, [reloadSavedAccounts]);

  const updateSavedAccount = useCallback(async (email: string, patch: Partial<Pick<SavedAccount, 'name' | 'color'>>) => {
    await updateSavedAccountStorage(email, patch);
    await reloadSavedAccounts();
  }, [reloadSavedAccounts]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    // Backend revoga as sessões antigas e emite tokens novos pra este device.
    const tokens = await authService.changePassword(currentPassword, newPassword);
    await tokenStorage.saveTokens(tokens.accessToken, tokens.refreshToken);
    const email = await tokenStorage.getActiveEmail();
    if (email) {
      await updateSavedAccountStorage(email, { refreshToken: tokens.refreshToken });
      await reloadSavedAccounts();
    }
  }, [reloadSavedAccounts]);

  const deleteAccount = useCallback(async (password: string) => {
    dispatch({ loading: true });
    try {
      const email = await tokenStorage.getActiveEmail();
      await authService.deleteAccount(password);
      if (email) await removeSavedAccountStorage(email);
      await reloadSavedAccounts();
      await clearSession();
    } catch (error) {
      dispatch({ loading: false });
      throw error;
    }
  }, [clearSession, reloadSavedAccounts]);

  /**
   * "Sair" suave: limpa só os tokens locais e volta pro hub, SEM revogar a sessão
   * no servidor — assim o login rápido por Face ID (refresh token salvo) continua
   * funcionando. O sign-out de verdade é "Remover conta" (X no hub).
   */
  const logout = useCallback(async () => {
    dispatch({ loading: true });
    await clearSession();
  }, [clearSession]);

  useEffect(() => {
    bootstrap();
    reloadSavedAccounts();
    return authEvents.onForceLogout(clearSession);
  }, [bootstrap, clearSession, reloadSavedAccounts]);

  // Registra o push token sempre que houver usuário logado (nunca no demo).
  useEffect(() => {
    if (!state.user || state.isDemo) return;
    (async () => {
      try {
        const { registerForPushNotifications } = await import('@/lib/pushNotifications');
        const token = await registerForPushNotifications();
        if (token) await authService.savePushToken(token);
      } catch {
        // best-effort; sem push se falhar
      }
    })();
  }, [state.user, state.isDemo]);

  const value = useMemo(
    () => ({ ...state, savedAccounts, login, register, loginWithSavedAccount, removeSavedAccount, updateSavedAccount, changePassword, deleteAccount, logout, bootstrap, enterDemo, exitDemo }),
    [state, savedAccounts, login, register, loginWithSavedAccount, removeSavedAccount, updateSavedAccount, changePassword, deleteAccount, logout, bootstrap, enterDemo, exitDemo]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return context;
}
