import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { normalizeError } from '@/lib/errorMap';
import { binanceService } from '@/services/binance.service';
import type { BinanceWallet, Quote } from '@/types/api.types';

export function useInvestments(symbol = 'BTC') {
  const [wallet, setWallet] = useState<BinanceWallet | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setWallet(await binanceService.wallet()); }
    catch (err) { setError(normalizeError(err).message); }
    finally { setLoading(false); }
  }, []);

  const loadQuote = useCallback(async () => {
    try { setQuote(await binanceService.quote(symbol)); } catch {}
  }, [symbol]);

  const stopPolling = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    loadQuote();
    timer.current = setInterval(loadQuote, 5000);
  }, [loadQuote, stopPolling]);

  useEffect(() => { loadWallet(); }, [loadWallet]);
  useEffect(() => {
    startPolling();
    const sub = AppState.addEventListener('change', (state) => state === 'active' ? startPolling() : stopPolling());
    return () => { sub.remove(); stopPolling(); };
  }, [startPolling, stopPolling]);

  return { wallet, quote, loading, error, reload: loadWallet };
}
