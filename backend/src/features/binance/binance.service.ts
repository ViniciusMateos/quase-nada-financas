import { BinanceRepository } from "./binance.repository.js";
import { BinanceClient } from "../../integrations/binance.client.js";
import { AuthService } from "../auth/auth.service.js";
import { encrypt, decrypt } from "../../lib/crypto.js";
import { redis } from "../../lib/redis.js";
import { Errors } from "../../lib/errors.js";
import { env } from "../../config/env.js";

interface QuotePayload {
  symbol: string;
  priceBrl: number;
  fetchedAt: string;
}

export class BinanceService {
  private readonly repo = new BinanceRepository();
  private readonly client = new BinanceClient();
  private readonly auth = new AuthService();

  async connect(userId: string, apiKey: string, apiSecret: string): Promise<void> {
    const existing = await this.repo.findByUser(userId);
    if (existing) throw Errors.Conflict("Conta Binance já conectada — use PUT para substituir");

    await this.assertCredentialsValid(apiKey, apiSecret);
    await this.repo.create({
      userId,
      apiKeyEnc: encrypt(apiKey),
      apiSecretEnc: encrypt(apiSecret),
    });
  }

  async replace(userId: string, apiKey: string, apiSecret: string): Promise<void> {
    await this.assertCredentialsValid(apiKey, apiSecret);
    await this.repo.upsertReplace({
      userId,
      apiKeyEnc: encrypt(apiKey),
      apiSecretEnc: encrypt(apiSecret),
    });
  }

  async disconnect(userId: string): Promise<void> {
    await this.repo.deleteByUser(userId);
  }

  async getWallet(userId: string) {
    const account = await this.repo.findByUser(userId);
    if (!account) throw Errors.NotFound("Conta Binance não conectada");

    const apiKey = decrypt(account.apiKeyEnc);
    const apiSecret = decrypt(account.apiSecretEnc);

    const balances = await this.client.getAccountBalances(apiKey, apiSecret);
    const nonZero = balances.filter((b) => b.free + b.locked > 0);

    let totalBrl = 0;
    const detailed = await Promise.all(
      nonZero.map(async (b) => {
        const quote = await this.fetchAssetQuoteBrl(b.asset);
        const totalAsset = b.free + b.locked;
        const totalBrlOnAsset = totalAsset * quote.priceBrl;
        totalBrl += totalBrlOnAsset;
        return {
          asset: b.asset,
          free: b.free,
          locked: b.locked,
          priceBrl: quote.priceBrl,
          totalBrl: round(totalBrlOnAsset),
        };
      })
    );

    return {
      totalBrl: round(totalBrl),
      assets: detailed,
      fetchedAt: new Date().toISOString(),
    };
  }

  async getQuote(symbol: string): Promise<QuotePayload> {
    return this.fetchAssetQuoteBrl(symbol);
  }

  async placeOrder(
    userId: string,
    asset: string,
    amountBrl: number,
    biometricToken: string
  ) {
    await this.auth.consumeBiometricChallenge(biometricToken, userId);

    const account = await this.repo.findByUser(userId);
    if (!account) throw Errors.NotFound("Conta Binance não conectada");

    const order = await this.repo.createOrder({
      userId,
      binanceAccountId: account.id,
      asset,
      amountBrl,
      orderType: "MARKET",
      triggerType: "MANUAL",
      status: "PENDING",
    });

    try {
      const apiKey = decrypt(account.apiKeyEnc);
      const apiSecret = decrypt(account.apiSecretEnc);

      const symbol = `${asset.toUpperCase()}BRL`;
      const response = await this.client.placeMarketBuy(apiKey, apiSecret, symbol, amountBrl);

      const filledQty = Number(response.executedQty ?? 0);
      const updated = await this.repo.updateOrder(order.id, {
        status: "FILLED",
        amountAsset: filledQty,
        binanceOrderId: String(response.orderId ?? ""),
        executedAt: new Date(),
        responseData: response as unknown as Record<string, unknown>,
      });
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      await this.repo.updateOrder(order.id, {
        status: "FAILED",
        errorMessage: message,
      });
      throw Errors.ExternalService(`Binance recusou a ordem: ${message}`);
    }
  }

  async listOrders(userId: string, cursor: string | undefined, limit: number) {
    return this.repo.listOrders(userId, cursor, limit);
  }

  private async assertCredentialsValid(apiKey: string, apiSecret: string): Promise<void> {
    try {
      await this.client.getAccountBalances(apiKey, apiSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "credenciais inválidas";
      throw Errors.Validation(`Falha ao validar credenciais Binance: ${message}`);
    }
  }

  private async fetchAssetQuoteBrl(asset: string): Promise<QuotePayload> {
    const symbol = asset.toUpperCase();
    const cacheKey = `quote:${symbol}BRL`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as QuotePayload;

    const price = await this.client.getSymbolPrice(`${symbol}BRL`);
    const payload: QuotePayload = {
      symbol,
      priceBrl: price,
      fetchedAt: new Date().toISOString(),
    };
    await redis.set(cacheKey, JSON.stringify(payload), "EX", env.BINANCE_QUOTE_TTL_SECONDS);
    return payload;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
