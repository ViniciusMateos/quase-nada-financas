import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';
import type { Category } from '@/types/api.types';

export const categoriesService = {
  list: () =>
    demoMode.isActive() ? demoApi.categories.list() : apiClient.get<unknown, Category[]>('/categories')
};
