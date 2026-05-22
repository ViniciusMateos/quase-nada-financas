import { request } from "undici";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

export interface MarketQuote {
  ticker: string;
  price: number;          // preço de mercado atual (regularMarketPrice)
  previousClose: number;  // fechamento do dia anterior
  changePct: number;      // variação do dia em %
}

// Cotação de carteira não precisa ser tick a tick — 10 min de cache evita
// martelar o Yahoo a cada pull-to-refresh.
const TTL_SECONDS = 600;
// Tickers B3: 4 letras + 1-2 dígitos (PETR4, ITSA3, JSRE11, BOVA11...).
const TICKER_RE = /^[A-Z]{4}\d{1,2}$/;

/**
 * Cotações da B3 via Yahoo Finance (endpoint público de chart, sem token).
 * Usado pra dar preço de mercado vivo + variação do dia aos ativos da
 * corretora — a Pluggy só manda o valor congelado da última sincronização.
 */
export class MarketClient {
  /** Cota um ticker B3 (sufixo .SA). Retorna null se indisponível/ inválido. */
  async getQuote(rawTicker: string): Promise<MarketQuote | null> {
    const ticker = rawTicker.trim().toUpperCase();
    if (!TICKER_RE.test(ticker)) return null;

    const cacheKey = `b3quote:${ticker}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as MarketQuote;
    } catch {
      // cache é otimização; segue pro fetch
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker
      )}.SA?interval=1d&range=5d`;
      const res = await request(url, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.statusCode >= 400) {
        await res.body.dump();
        return null;
      }
      const json = (await res.body.json()) as {
        chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }> };
      };
      const meta = json?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (typeof price !== "number") return null;
      const prev =
        typeof meta?.chartPreviousClose === "number"
          ? meta.chartPreviousClose
          : typeof meta?.previousClose === "number"
            ? meta.previousClose
            : price;
      const quote: MarketQuote = {
        ticker,
        price,
        previousClose: prev,
        changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
      };
      try {
        await redis.set(cacheKey, JSON.stringify(quote), "EX", TTL_SECONDS);
      } catch {
        // ignora falha de cache
      }
      return quote;
    } catch (err) {
      logger.warn({ err, ticker }, "Cotação Yahoo falhou");
      return null;
    }
  }

  /** Cota vários tickers em paralelo. Mapa ticker -> quote (só os que vieram). */
  async getQuotes(tickers: string[]): Promise<Map<string, MarketQuote>> {
    const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()))];
    const results = await Promise.all(unique.map((t) => this.getQuote(t)));
    const map = new Map<string, MarketQuote>();
    for (const q of results) if (q) map.set(q.ticker, q);
    return map;
  }
}
