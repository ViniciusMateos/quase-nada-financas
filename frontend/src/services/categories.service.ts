import { apiClient } from '@/lib/apiClient';
import type { Category } from '@/types/api.types';

export const categoriesService = {
  list: () => apiClient.get<unknown, Category[]>('/categories')
};
