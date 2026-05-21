import { apiClient } from '@/lib/apiClient';
import type { BinanceWallet, Order, Quote } from '@/types/api.types';

export const binanceService = {
  connect: (apiKey: string, apiSecret: string) => apiClient.post<unknown, void>('/binance/connect', { apiKey, apiSecret }),
  replace: (apiKey: string, apiSecret: string) => apiClient.put<unknown, void>('/binance/connect', { apiKey, apiSecret }),
  disconnect: () => apiClient.delete<unknown, void>('/binance/connect'),
  wallet: () => apiClient.get<unknown, BinanceWallet>('/binance/wallet'),
  quote: (symbol: string) => apiClient.get<unknown, Quote>(`/binance/quote/${symbol}`),
  placeOrder: (payload: { asset: string; amountBrl: number; biometricToken: string }) =>
    apiClient.post<unknown, Order>('/binance/orders', payload)
};
