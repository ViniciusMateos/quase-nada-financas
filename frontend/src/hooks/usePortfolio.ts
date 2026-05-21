import { useCallback, useEffect, useState } from 'react';
import { useDataRefreshKey } from '@/contexts/DataRefreshContext';
import { normalizeError } from '@/lib/errorMap';
import { portfolioService, type Portfolio } from '@/services/portfolio.service';

export function usePortfolio() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useDataRefreshKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await portfolioService.get());
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return { data, loading, error, reload: load };
}
