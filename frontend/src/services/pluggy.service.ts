import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';

export const pluggyService = {
  connectToken: (oauthRedirectUri?: string) =>
    demoMode.isActive()
      ? demoApi.pluggy.unavailable()
      : apiClient.post<unknown, { connectToken: string; expiresAt?: string | null; meuPluggyConnectorId: number | null }>(
          '/pluggy/connect-token',
          oauthRedirectUri ? { oauthRedirectUri } : {}
        ),
  callback: (itemId: string) =>
    demoMode.isActive() ? demoApi.pluggy.unavailable() : apiClient.post<unknown, void>('/pluggy/callback', { itemId })
};
