import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Sequência de requisições: respostas obsoletas (de um filtro anterior, ou de
  // um loadMore que terminou depois de trocar o filtro) são descartadas. Sem
  // isso, uma página antiga chega depois e é anexada à lista nova, embaralhando
  // a ordem e "fixando" transações que não são mais do filtro atual.
  const seqRef = useRef(0);

  const load = useCallback(async (cursor?: string | null) => {
    const seq = ++seqRef.current;
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
      if (seq !== seqRef.current) return; // resposta obsoleta — ignora
      setItems((current) => {
        if (!cursor) return page.items;
        const seen = new Set(current.map((t) => t.id));
        return [...current, ...page.items.filter((t) => !seen.has(t.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (seq === seqRef.current) setError(normalizeError(err).message);
    } finally {
      if (seq === seqRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [filters]);

  useEffect(() => { load(null); }, [load, refreshKey]);
  return { items, filters, setFilters, nextCursor, loading, loadingMore, error, reload: () => load(null), loadMore: () => nextCursor && !loadingMore ? load(nextCursor) : undefined };
}
