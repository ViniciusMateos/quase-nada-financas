import { useCallback, useEffect, useState } from 'react';
import { useDataRefreshKey } from '@/contexts/DataRefreshContext';
import { normalizeError } from '@/lib/errorMap';
import { transactionsService } from '@/services/transactions.service';
import type { Transaction } from '@/types/api.types';

export type TransactionFilters = {
  accountId?: string;
  accountIds?: string[];
  accountType?: 'BANK' | 'CREDIT';
  categoryId?: string;
  startDate?: string;
  endDate?: string;
};

export function useTransactions(initialFilters: TransactionFilters = {}) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshKey = useDataRefreshKey();

  const load = useCallback(async (cursor?: string | null) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const { accountIds, ...rest } = filters;
      const params: Record<string, string | number | undefined> = {
        ...rest,
        cursor: cursor || undefined,
        limit: 20,
      };
      if (accountIds && accountIds.length > 0) params.accountIds = accountIds.join(',');
      const page = await transactionsService.list(params);
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => { load(null); }, [load, refreshKey]);
  return { items, filters, setFilters, nextCursor, loading, loadingMore, error, reload: () => load(null), loadMore: () => nextCursor && !loadingMore ? load(nextCursor) : undefined };
}
