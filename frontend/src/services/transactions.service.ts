import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';
import type { PaginatedTransactions, Transaction } from '@/types/api.types';

export type TransactionsSummary = {
  income: number;
  expense: number;
  net: number;
  count: number;
};

export type UpdateTransactionBody = {
  alias?: string | null;
  categoryId?: string;
  isSubscriptionOverride?: boolean | null;
};

export type UpdateTransactionResult = {
  updated: Transaction;
  affectedSimilar: number;
};

export const transactionsService = {
  list: (params: Record<string, string | number | undefined>) =>
    demoMode.isActive()
      ? demoApi.transactions.list(params)
      : apiClient.get<unknown, PaginatedTransactions>('/transactions', { params }),
  summary: (params: { startDate?: string; endDate?: string; accountId?: string; accountIds?: string; accountType?: 'BANK' | 'CREDIT' }) =>
    demoMode.isActive()
      ? demoApi.transactions.summary(params)
      : apiClient.get<unknown, TransactionsSummary>('/transactions/summary', { params }),
  similar: (transactionId: string) =>
    demoMode.isActive()
      ? demoApi.transactions.similar(transactionId)
      : apiClient.get<unknown, { items: Transaction[] }>(`/transactions/${transactionId}/similar`),
  updateCategory: (transactionId: string, categoryId: string) =>
    demoMode.isActive()
      ? demoApi.transactions.updateCategory(transactionId, categoryId)
      : apiClient.patch<unknown, Transaction>(`/transactions/${transactionId}/category`, { categoryId }),
  update: (transactionId: string, body: UpdateTransactionBody) =>
    demoMode.isActive()
      ? demoApi.transactions.update(transactionId, body)
      : apiClient.patch<UpdateTransactionBody, UpdateTransactionResult>(`/transactions/${transactionId}`, body),
};
