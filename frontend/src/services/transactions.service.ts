import { apiClient } from '@/lib/apiClient';
import type { PaginatedTransactions, Transaction } from '@/types/api.types';

export const transactionsService = {
  list: (params: Record<string, string | number | undefined>) =>
    apiClient.get<unknown, PaginatedTransactions>('/transactions', { params }),
  updateCategory: (transactionId: string, categoryId: string) =>
    apiClient.patch<unknown, Transaction>(`/transactions/${transactionId}/category`, { categoryId })
};
