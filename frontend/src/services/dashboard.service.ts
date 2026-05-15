import { apiClient } from '@/lib/apiClient';
import type { Dashboard } from '@/types/api.types';

export const dashboardService = {
  fetch: (month: string) => apiClient.get<unknown, Dashboard>('/dashboard', { params: { month } })
};
