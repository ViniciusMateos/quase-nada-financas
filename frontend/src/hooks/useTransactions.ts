import { useCallback, useEffect, useState } from 'react';
import { normalizeError } from '@/lib/errorMap';
import { transactionsService } from '@/services/transactions.service';
import type { Transaction } from '@/types/api.types';

export type TransactionFilters = {
  accountId?: string;
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

  const load = useCallback(async (cursor?: string | null) => {
    cursor ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const page = await transactionsService.list({ ...filters, cursor: cursor || undefined, limit: 20 });
      setItems((current) => cursor ? [...current, ...page.items] : page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(normalizeError(err).message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters]);

  useEffect(() => { load(null); }, [load]);
  return { items, filters, setFilters, nextCursor, loading, loadingMore, error, reload: () => load(null), loadMore: () => nextCursor && !loadingMore ? load(nextCursor) : undefined };
}
