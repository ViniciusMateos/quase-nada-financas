import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';
import type { Dashboard } from '@/types/api.types';

export const dashboardService = {
  fetch: (month: string) =>
    demoMode.isActive()
      ? demoApi.dashboard.fetch(month)
      : apiClient.get<unknown, Dashboard>('/dashboard', { params: { month } })
};
