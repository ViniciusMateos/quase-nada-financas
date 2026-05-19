import { apiClient } from '@/lib/apiClient';

export const accountsService = {
  list: () => apiClient.get<unknown, any>('/accounts'),
  remove: (id: string) => apiClient.delete<unknown, void>(`/accounts/${id}`),
  sync: (id: string) => apiClient.post<unknown, void>(`/accounts/${id}/sync`),
  rename: (id: string, customName: string | null) =>
    apiClient.patch<unknown, void>(`/accounts/${id}`, { customName }),
  setCreditCloseDay: (bankAccountId: string, creditCloseDay: number | null) =>
    apiClient.patch<unknown, { ok: true }>(
      `/accounts/bank-account/${bankAccountId}/credit-close-day`,
      { creditCloseDay }
    ),
};