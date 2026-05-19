import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface DataRefreshValue {
  /** Contador que aumenta a cada bump. Use como dep em useEffect pra refetch. */
  refreshKey: number;
  /** Sinaliza que os dados servidor mudaram — todos os hooks que escutam refetcham. */
  bump(): void;
}

const DataRefreshContext = createContext<DataRefreshValue | null>(null);

/**
 * Broadcast global de "dados mudaram". Usado pra invalidar caches/refetches
 * sem depender de pull-to-refresh ou foco de tela.
 *
 * Quem chama bump():
 *  - ConnectBankScreen depois de conectar conta
 *  - useAccounts.sync e .remove (após mutação no servidor)
 *  - EditTransactionSheet / NewOrder / etc após salvar
 *
 * Quem escuta (via useDataRefreshKey como dep do useEffect):
 *  - useAccounts, useDashboard, useTransactions, useInvestments
 *  - Telas com fetch próprio (Categories, Subscriptions, Installments)
 */
export function DataRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setKey] = useState(0);
  const bump = useCallback(() => setKey((k) => k + 1), []);
  const value = useMemo<DataRefreshValue>(() => ({ refreshKey, bump }), [refreshKey, bump]);
  return <DataRefreshContext.Provider value={value}>{children}</DataRefreshContext.Provider>;
}

export function useDataRefreshKey(): number {
  const ctx = useContext(DataRefreshContext);
  if (!ctx) return 0;
  return ctx.refreshKey;
}

export function useDataRefresh(): () => void {
  const ctx = useContext(DataRefreshContext);
  if (!ctx) return () => undefined;
  return ctx.bump;
}
