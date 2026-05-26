import { apiClient } from '@/lib/apiClient';
import { demoMode } from '@/lib/demoMode';
import { demoApi } from '@/demo/demoStore';
import type { BinanceWallet, Order, Quote } from '@/types/api.types';

export const binanceService = {
  connect: (apiKey: string, apiSecret: string) =>
    demoMode.isActive() ? demoApi.binance.connect() : apiClient.post<unknown, void>('/binance/connect', { apiKey, apiSecret }),
  replace: (apiKey: string, apiSecret: string) =>
    demoMode.isActive() ? demoApi.binance.replace() : apiClient.put<unknown, void>('/binance/connect', { apiKey, apiSecret }),
  disconnect: () =>
    demoMode.isActive() ? demoApi.binance.disconnect() : apiClient.delete<unknown, void>('/binance/connect'),
  wallet: () =>
    demoMode.isActive() ? demoApi.binance.wallet() : apiClient.get<unknown, BinanceWallet>('/binance/wallet'),
  quote: (symbol: string) =>
    demoMode.isActive() ? demoApi.binance.quote(symbol) : apiClient.get<unknown, Quote>(`/binance/quote/${symbol}`),
  placeOrder: (payload: { asset: string; amountBrl: number; biometricToken: string }) =>
    demoMode.isActive() ? demoApi.binance.placeOrder(payload) : apiClient.post<unknown, Order>('/binance/orders', payload)
};
