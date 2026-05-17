import { apiClient } from '@/lib/apiClient';

export const pluggyService = {
  connectToken: (oauthRedirectUri?: string) =>
    apiClient.post<unknown, { connectToken: string; expiresAt: string | null }>(
      '/pluggy/connect-token',
      oauthRedirectUri ? { oauthRedirectUri } : {}
    ),
  callback: (itemId: string) => apiClient.post<unknown, void>('/pluggy/callback', { itemId })
};
