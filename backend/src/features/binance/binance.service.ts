import { Prisma } from "@prisma/client";
import { BinanceRepository } from "./binance.repository.js";
import { BinanceClient } from "../../integrations/binance.client.js";
import { AuthService } from "../auth/auth.service.js";
import { encrypt, decrypt } from "../../lib/crypto.js";
import { redis } from "../../lib/redis.js";
import { Errors } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { sendPushToUser } from "../../lib/push.js";

interface QuotePayload {
  symbol: string;
  priceBRL: number;
  priceBrl: number; // legacy
  updatedAt: string;
  fetchedAt: string; // legacy
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

    // Pega balances do Spot + Funding em paralelo (Funding é onde fica
    // BTC/USDT vindo de P2P/Pay). Erros no Funding não bloqueiam.
    const [spot, funding] = await Promise.all([
      this.client.getAccountBalances(apiKey, apiSecret),
      this.client.getFundingBalances(apiKey, apiSecret).catch(() => []),
    ]);

    // Agrega: mesmo asset somando spot + funding
    const map = new Map<string, { asset: string; free: number; locked: number }>();
    for (const list of [spot, funding]) {
      for (const b of list) {
        const cur = map.get(b.asset) ?? { asset: b.asset, free: 0, locked: 0 };
        cur.free += b.free;
        cur.locked += b.locked;
        map.set(b.asset, cur);
      }
    }
    const balances = [...map.values()];
    const nonZero = balances.filter((b) => b.free + b.locked > 0);

    let totalBrl = 0;
    const detailed = await Promise.all(
      nonZero.map(async (b) => {
        const totalAsset = b.free + b.locked;
        // BRL é a moeda de referência — não tem par BRLBRL.
        // Outras stablecoins atreladas ao BRL podem ser tratadas igual no futuro.
        if (b.asset === "BRL") {
          totalBrl += totalAsset;
          return {
            asset: b.asset,
            free: b.free,
            locked: b.locked,
            priceBrl: 1,
            totalBrl: round(totalAsset),
          };
        }
        try {
          const quote = await this.fetchAssetQuoteBrl(b.asset);
          const totalBrlOnAsset = totalAsset * quote.priceBrl;
          totalBrl += totalBrlOnAsset;
          return {
            asset: b.asset,
            free: b.free,
            locked: b.locked,
            priceBrl: quote.priceBrl,
            totalBrl: round(totalBrlOnAsset),
          };
        } catch {
          // Ativo sem par BRL na Binance — retorna posição com priceBrl=0
          // ao invés de quebrar a wallet inteira.
          return {
            asset: b.asset,
            free: b.free,
            locked: b.locked,
            priceBrl: 0,
            totalBrl: 0,
          };
        }
      })
    );

    return {
      connected: true,
      totalBRL: round(totalBrl),
      assets: detailed.map((d) => ({
        symbol: d.asset,
        name: d.asset,
        quantity: round8(d.free + d.locked),
        valueBRL: d.totalBrl,
        change24h: 0,
      })),
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
    return this.executeOrder(userId, asset, amountBrl, "MANUAL");
  }

  /**
   * Execução automatizada disparada por InvestmentRule (após o usuário aprovar
   * a PendingAction). Não exige biometria, mas marca triggerType="AUTO" pra
   * rastreabilidade.
   */
  async placeOrderAutomated(userId: string, asset: string, amountBrl: number) {
    return this.executeOrder(userId, asset, amountBrl, "AUTO");
  }

  private async executeOrder(
    userId: string,
    asset: string,
    amountBrl: number,
    triggerType: "MANUAL" | "AUTO"
  ) {
    const account = await this.repo.findByUser(userId);
    if (!account) throw Errors.NotFound("Conta Binance não conectada");

    const order = await this.repo.createOrder({
      userId,
      binanceAccountId: account.id,
      asset,
      amountBrl,
      orderType: "MARKET",
      triggerType,
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
        responseData: response as unknown as Prisma.InputJsonValue,
      });

      void sendPushToUser(
        userId,
        "Ordem executada ✅",
        `Compra de ${formatBrl(amountBrl)} em ${asset.toUpperCase()} liquidada (${filledQty} ${asset.toUpperCase()}).`,
        { type: "order_filled", orderId: updated.id }
      );

      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      await this.repo.updateOrder(order.id, {
        status: "FAILED",
        errorMessage: message,
      });
      // Binance code -2010 / "insufficient balance" → erro específico pro app
      // oferecer carregar saldo.
      if (/insufficient balance|-2010/i.test(message)) {
        throw Errors.InsufficientBalance(
          "Saldo insuficiente na Binance. Carregue sua conta e tente de novo."
        );
      }
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
    const now = new Date().toISOString();
    const payload: QuotePayload = {
      symbol,
      priceBRL: price,
      priceBrl: price, // legacy
      updatedAt: now,
      fetchedAt: now, // legacy
    };
    await redis.set(cacheKey, JSON.stringify(payload), "EX", env.BINANCE_QUOTE_TTL_SECONDS);
    return payload;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

/** Arredondamento pra 8 casas (precisão de satoshi). Usado pra quantidade de cripto. */
function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}
