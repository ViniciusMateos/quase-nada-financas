import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';

export const accountsService = {
  list: () =>
    demoMode.isActive() ? demoApi.accounts.list() : apiClient.get<unknown, any>('/accounts'),
  remove: (id: string) =>
    demoMode.isActive() ? demoApi.accounts.remove() : apiClient.delete<unknown, void>(`/accounts/${id}`),
  sync: (id: string) =>
    demoMode.isActive() ? demoApi.accounts.sync() : apiClient.post<unknown, void>(`/accounts/${id}/sync`),
  rename: (id: string, customName: string | null) =>
    demoMode.isActive()
      ? demoApi.accounts.rename()
      : apiClient.patch<unknown, void>(`/accounts/${id}`, { customName }),
  setCreditCloseDay: (bankAccountId: string, creditCloseDay: number | null) =>
    demoMode.isActive()
      ? demoApi.accounts.setCreditCloseDay()
      : apiClient.patch<unknown, { ok: true }>(
          `/accounts/bank-account/${bankAccountId}/credit-close-day`,
          { creditCloseDay }
        ),
};
