import { apiClient } from '@/lib/apiClient';

export const accountsService = {
  list: () => apiClient.get<unknown, any>('/accounts'),
  remove: (id: string) => apiClient.delete<unknown, void>(`/accounts/${id}`),
  sync: (id: string) => apiClient.post<unknown, void>(`/accounts/${id}/sync`)
};