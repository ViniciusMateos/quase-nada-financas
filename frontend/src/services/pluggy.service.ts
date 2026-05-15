import { apiClient } from '@/lib/apiClient';

export const pluggyService = {
  connectToken: () => apiClient.post<unknown, { connectToken: string; expiresAt: string | null }>('/pluggy/connect-token'),
  callback: (itemId: string) => apiClient.post<unknown, void>('/pluggy/callback', { itemId })
};
