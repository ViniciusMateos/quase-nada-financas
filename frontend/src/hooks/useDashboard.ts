import { useCallback, useEffect, useState } from 'react';
import { cacheStorage } from '@/lib/cacheStorage';
import { useDataRefreshKey } from '@/contexts/DataRefreshContext';
import { normalizeError } from '@/lib/errorMap';
import { currentMonth } from '@/lib/formatters';
import { dashboardService } from '@/services/dashboard.service';
import type { Dashboard } from '@/types/api.types';

export function useDashboard(month = currentMonth()) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useDataRefreshKey();

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    mode === 'refresh' ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const next = await dashboardService.fetch(month);
      setData(next);
      await cacheStorage.set(`dashboard:${month}`, next);
    } catch (err) {
      const cached = await cacheStorage.get<Dashboard>(`dashboard:${month}`);
      if (cached) setData(cached);
      else setError(normalizeError(err).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load, refreshKey]);
  return { data, loading, refreshing, error, refresh: () => load('refresh'), retry: () => load('initial') };
}
