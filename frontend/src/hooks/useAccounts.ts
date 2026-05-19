import { Alert } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { cacheStorage } from '@/lib/cacheStorage';
import { normalizeError } from '@/lib/errorMap';
import { accountsService } from '@/services/accounts.service';
import { useDataRefresh, useDataRefreshKey } from '@/contexts/DataRefreshContext';
import type { Account } from '@/types/api.types';

function normalizeAccounts(payload: any): Account[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.accounts)) return payload.accounts;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function useAccounts() {
  const [items, setItems] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const refreshKey = useDataRefreshKey();
  const bumpRefresh = useDataRefresh();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await accountsService.list();
      const accounts = normalizeAccounts(response);

      setItems(accounts);
      await cacheStorage.set('accounts', accounts);
    } catch (err) {
      const cached = await cacheStorage.get<Account[]>('accounts');

      if (Array.isArray(cached)) {
        setItems(cached);
      } else {
        setItems([]);
        setError(normalizeError(err).message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const remove = useCallback((id: string) => {
    Alert.alert('Excluir esta conta?', 'Suas transacoes serao removidas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);

          try {
            await accountsService.remove(id);
            setItems((current) => {
              const safeCurrent = Array.isArray(current) ? current : [];
              return safeCurrent.filter((account) => account.id !== id);
            });
            bumpRefresh();
          } finally {
            setBusyId(null);
          }
        }
      }
    ]);
  }, [bumpRefresh]);

  const sync = useCallback(async (id: string) => {
    setBusyId(id);

    try {
      await accountsService.sync(id);
      await load();
      bumpRefresh();
    } finally {
      setBusyId(null);
    }
  }, [load, bumpRefresh]);

  const rename = useCallback(async (id: string, customName: string | null) => {
    await accountsService.rename(id, customName);
    await load();
    bumpRefresh();
  }, [load, bumpRefresh]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return {
    items,
    loading,
    error,
    busyId,
    load,
    remove,
    sync,
    rename
  };
}