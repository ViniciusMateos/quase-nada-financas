import { createHmac } from "node:crypto";
import { request } from "undici";
import { env } from "../config/env.js";

export interface BinanceBalance {
  asset: string;
  free: number;
  locked: number;
}

export interface BinanceOrderResponse {
  orderId: number | string;
  status: string;
  executedQty?: string;
  cummulativeQuoteQty?: string;
  fills?: Array<{ price: string; qty: string }>;
}

const RECV_WINDOW = 5000;

export class BinanceClient {
  /**
   * Cotação pública (sem assinatura).
   */
  async getSymbolPrice(symbol: string): Promise<number> {
    const url = `${env.BINANCE_API_URL}/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
    const res = await request(url, { method: "GET" });
    if (res.statusCode === 400 || res.statusCode === 404) {
      throw new Error(`Símbolo ${symbol} não disponível na Binance`);
    }
    if (res.statusCode >= 400) {
      throw new Error(`Binance ticker error (${res.statusCode})`);
    }
    const json = (await res.body.json()) as { price: string };
    return Number(json.price);
  }

  async getAccountBalances(apiKey: string, apiSecret: string): Promise<BinanceBalance[]> {
    const params = new URLSearchParams();
    params.set("timestamp", Date.now().toString());
    params.set("recvWindow", String(RECV_WINDOW));
    const signed = this.sign(params, apiSecret);

    const res = await request(`${env.BINANCE_API_URL}/api/v3/account?${signed}`, {
      method: "GET",
      headers: { "X-MBX-APIKEY": apiKey },
    });
    if (res.statusCode >= 400) {
      const body = await res.body.text();
      throw new Error(`Binance account error (${res.statusCode}): ${body}`);
    }
    const json = (await res.body.json()) as {
      balances: Array<{ asset: string; free: string; locked: string }>;
    };
    return json.balances.map((b) => ({
      asset: b.asset,
      free: Number(b.free),
      locked: Number(b.locked),
    }));
  }

  /**
   * Ordem MARKET BUY usando quoteOrderQty (valor em moeda de cotação — BRL).
   */
  async placeMarketBuy(
    apiKey: string,
    apiSecret: string,
    symbol: string,
    quoteOrderQty: number
  ): Promise<BinanceOrderResponse> {
    const params = new URLSearchParams();
    params.set("symbol", symbol);
    params.set("side", "BUY");
    params.set("type", "MARKET");
    params.set("quoteOrderQty", quoteOrderQty.toFixed(2));
    params.set("timestamp", Date.now().toString());
    params.set("recvWindow", String(RECV_WINDOW));
    const signed = this.sign(params, apiSecret);

    const res = await request(`${env.BINANCE_API_URL}/api/v3/order?${signed}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": apiKey },
    });
    const body = await res.body.text();
    if (res.statusCode >= 400) {
      throw new Error(`Binance order error (${res.statusCode}): ${body}`);
    }
    return JSON.parse(body) as BinanceOrderResponse;
  }

  /**
   * Concatena query string e assina via HMAC-SHA256, retornando a string final
   * com `signature=...` anexada.
   */
  private sign(params: URLSearchParams, apiSecret: string): string {
    const query = params.toString();
    const signature = createHmac("sha256", apiSecret).update(query).digest("hex");
    return `${query}&signature=${signature}`;
  }
}
