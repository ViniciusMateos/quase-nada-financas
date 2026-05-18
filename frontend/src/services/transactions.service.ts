import { apiClient } from '@/lib/apiClient';
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
    apiClient.get<unknown, PaginatedTransactions>('/transactions', { params }),
  summary: (params: { startDate?: string; endDate?: string; accountId?: string; accountIds?: string; accountType?: 'BANK' | 'CREDIT' }) =>
    apiClient.get<unknown, TransactionsSummary>('/transactions/summary', { params }),
  similar: (transactionId: string) =>
    apiClient.get<unknown, { items: Transaction[] }>(`/transactions/${transactionId}/similar`),
  updateCategory: (transactionId: string, categoryId: string) =>
    apiClient.patch<unknown, Transaction>(`/transactions/${transactionId}/category`, { categoryId }),
  update: (transactionId: string, body: UpdateTransactionBody) =>
    apiClient.patch<UpdateTransactionBody, UpdateTransactionResult>(`/transactions/${transactionId}`, body),
};
