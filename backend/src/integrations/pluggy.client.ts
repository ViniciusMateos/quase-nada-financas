import { request } from "undici";
import { env } from "../config/env.js";

import { Errors } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export interface PluggyCreditData {
  level?: string;
  brand?: string;
  balanceCloseDate?: string;
  balanceDueDate?: string;
  availableCreditLimit?: number;
  creditLimit?: number;
  minimumPayment?: number;
  isPaid?: boolean;
}

export interface PluggyAccount {
  id: string;
  type?: string;
  subtype?: string;
  name?: string;
  marketingName?: string;
  number?: string;
  balance?: number;
  currencyCode?: string;
  creditData?: PluggyCreditData;
}

export interface PluggyTransaction {
  id: string;
  date: string;
  amount: number;
  currencyCode?: string;
  description?: string;
  merchant?: { name?: string; mcc?: string };
  paymentData?: { paymentMethod?: string };
  creditCardMetadata?: { installmentNumber?: number; totalInstallments?: number; purchaseDate?: string };
}

export interface PluggyInvestment {
  id: string;
  name?: string;
  code?: string;       // ticker B3 (ex: ITSA3, JSRE11) — quando disponível
  isin?: string;
  type?: string;       // MUTUAL_FUND | FIXED_INCOME | EQUITY | ETF | SECURITY | COE | ...
  subtype?: string;    // STOCK | REAL_ESTATE_FUND | TREASURY | CDB | LCI | LCA | ...
  currencyCode?: string;
  quantity?: number;
  value?: number;       // valor unitário/cota atual
  amount?: number;      // valor investido (bruto)
  balance?: number;     // valor líquido atual
  amountProfit?: number;// lucro/prejuízo
  amountWithdrawal?: number; // disponível pra resgate
  annualRate?: number;
  lastTwelveMonthsRate?: number;
  dueDate?: string;     // vencimento (renda fixa)
}

export interface PluggyInvestmentTransaction {
  id: string;
  type?: string;   // BUY | SELL | TAX | TRANSFER
  date?: string;
  amount?: number;
  quantity?: number;
  value?: number;
}

interface PluggyAuthResponse { apiKey: string }
interface PluggyConnectTokenResponse { accessToken: string }
interface PluggyItemResponse {
  id: string;
  consentExpiresAt?: string;
  connector?: { name?: string; imageUrl?: string; primaryColor?: string };
  clientUserId?: string;
  status?: string;
  executionStatus?: string;
}

// ID conhecido e estável do conector MeuPluggy (visto no Dashboard: "(200) MeuPluggy").
// Usado como fallback caso a busca dinâmica em /connectors falhe.
const MEU_PLUGGY_CONNECTOR_ID = 200;

export class PluggyClient {
  private apiKeyCache: { key: string; expiresAt: number } | null = null;
  // undefined = ainda não resolvido. IDs de conector são estáveis, então cacheia.
  private meuPluggyConnectorId: number | undefined = undefined;

  private async getApiKey(): Promise<string> {
    const now = Date.now();
    if (this.apiKeyCache && this.apiKeyCache.expiresAt > now) {
      return this.apiKeyCache.key;
    }

    const res = await request(`${env.PLUGGY_API_URL}/auth`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: env.PLUGGY_CLIENT_ID,
        clientSecret: env.PLUGGY_CLIENT_SECRET,
      }),
    });

    if (res.statusCode >= 400) {
      const body = await res.body.text();
      logger.error({ status: res.statusCode, body }, "Pluggy auth failed");
      throw Errors.ExternalService("Pluggy auth failed");
    }

    const json = (await res.body.json()) as PluggyAuthResponse;
    // Pluggy apiKey vale ~2h; cache de 90min para segurança
    this.apiKeyCache = { key: json.apiKey, expiresAt: now + 90 * 60_000 };
    return json.apiKey;
  }

  async createConnectToken(userId: string, oauthRedirectUri?: string): Promise<string> {
    const apiKey = await this.getApiKey();
    const options: Record<string, unknown> = {
      clientUserId: userId,
      sandbox: env.NODE_ENV !== 'production',
    };
    if (oauthRedirectUri) options.oauthRedirectUri = oauthRedirectUri;

    const res = await request(`${env.PLUGGY_API_URL}/connect_token`, {
      method: "POST",
      headers: { "content-type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ options }),
    });
    if (res.statusCode >= 400) {
      throw Errors.ExternalService(`Pluggy connect_token failed (${res.statusCode})`);
    }
    const json = (await res.body.json()) as PluggyConnectTokenResponse;
    return json.accessToken;
  }

  /**
   * Resolve o ID do conector "MeuPluggy" via GET /connectors, com fallback para o
   * ID conhecido (200). Sempre retorna um ID — o objetivo é abrir direto no
   * MeuPluggy. Cacheado em memória.
   */
  async getMeuPluggyConnectorId(): Promise<number> {
    if (this.meuPluggyConnectorId !== undefined) return this.meuPluggyConnectorId;
    try {
      const apiKey = await this.getApiKey();
      const res = await request(`${env.PLUGGY_API_URL}/connectors?name=${encodeURIComponent("MeuPluggy")}`, {
        method: "GET",
        headers: { "X-API-KEY": apiKey },
      });
      if (res.statusCode < 400) {
        const json = (await res.body.json()) as { results?: { id: number; name: string }[] };
        const results = json.results ?? [];
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
        const match =
          results.find((c) => norm(c.name) === "meupluggy") ??
          results.find((c) => norm(c.name).includes("meupluggy"));
        if (match) {
          this.meuPluggyConnectorId = match.id;
          return match.id;
        }
        logger.warn("Conector MeuPluggy não encontrado em /connectors; usando fallback 200");
      } else {
        logger.warn({ status: res.statusCode }, "Pluggy getConnectors (MeuPluggy) falhou; usando fallback 200");
      }
    } catch {
      // erro transitório: usa o fallback sem cachear (tenta de novo na próxima)
      return MEU_PLUGGY_CONNECTOR_ID;
    }
    this.meuPluggyConnectorId = MEU_PLUGGY_CONNECTOR_ID;
    return MEU_PLUGGY_CONNECTOR_ID;
  }

  async getItem(itemId: string): Promise<PluggyItemResponse> {
    const apiKey = await this.getApiKey();
    const res = await request(`${env.PLUGGY_API_URL}/items/${itemId}`, {
      method: "GET",
      headers: { "X-API-KEY": apiKey },
    });
    if (res.statusCode >= 400) {
      throw Errors.ExternalService(`Pluggy getItem failed (${res.statusCode})`);
    }
    return (await res.body.json()) as PluggyItemResponse;
  }

  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    const apiKey = await this.getApiKey();
    const res = await request(`${env.PLUGGY_API_URL}/accounts?itemId=${encodeURIComponent(itemId)}`, {
      method: "GET",
      headers: { "X-API-KEY": apiKey },
    });
    if (res.statusCode >= 400) {
      throw Errors.ExternalService(`Pluggy listAccounts failed (${res.statusCode})`);
    }
    const json = (await res.body.json()) as { results: PluggyAccount[] };
    return json.results ?? [];
  }

  async listTransactions(accountId: string, since: Date): Promise<PluggyTransaction[]> {
    const apiKey = await this.getApiKey();
    const fromIso = since.toISOString().slice(0, 10);
    const all: PluggyTransaction[] = [];
    let page = 1;
    const pageSize = 200;

    while (true) {
      const url = `${env.PLUGGY_API_URL}/transactions?accountId=${encodeURIComponent(accountId)}&from=${fromIso}&page=${page}&pageSize=${pageSize}`;
      const res = await request(url, { method: "GET", headers: { "X-API-KEY": apiKey } });
      if (res.statusCode >= 400) {
        throw Errors.ExternalService(`Pluggy listTransactions failed (${res.statusCode})`);
      }
      const json = (await res.body.json()) as { results: PluggyTransaction[]; total?: number };
      const items = json.results ?? [];
      all.push(...items);
      if (items.length < pageSize) break;
      page++;
      if (page > 50) break; // safety stop
    }

    return all;
  }

  /**
   * Lista os investimentos de um item (corretora conectada via Open Finance).
   * Retorna [] em 4xx — contas que não são de investimento (ex: banco puro)
   * podem responder erro, e isso não deve quebrar o portfólio.
   */
  async listInvestments(itemId: string): Promise<PluggyInvestment[]> {
    const apiKey = await this.getApiKey();
    const res = await request(`${env.PLUGGY_API_URL}/investments?itemId=${encodeURIComponent(itemId)}`, {
      method: "GET",
      headers: { "X-API-KEY": apiKey },
    });
    if (res.statusCode >= 400) {
      logger.warn({ status: res.statusCode, itemId }, "Pluggy listInvestments sem dados");
      return [];
    }
    const json = (await res.body.json()) as { results?: PluggyInvestment[] };
    return json.results ?? [];
  }

  /** Movimentos de um investimento (BUY/SELL/TAX/TRANSFER). [] em 4xx. */
  async listInvestmentTransactions(investmentId: string): Promise<PluggyInvestmentTransaction[]> {
    const apiKey = await this.getApiKey();
    const res = await request(
      `${env.PLUGGY_API_URL}/investments/${encodeURIComponent(investmentId)}/transactions`,
      { method: "GET", headers: { "X-API-KEY": apiKey } }
    );
    if (res.statusCode >= 400) return [];
    const json = (await res.body.json()) as { results?: PluggyInvestmentTransaction[] };
    return json.results ?? [];
  }

  async deleteItem(itemId: string): Promise<void> {
    const apiKey = await this.getApiKey();
    const res = await request(`${env.PLUGGY_API_URL}/items/${itemId}`, {
      method: "DELETE",
      headers: { "X-API-KEY": apiKey },
    });
    if (res.statusCode >= 400 && res.statusCode !== 404) {
      throw Errors.ExternalService(`Pluggy deleteItem failed (${res.statusCode})`);
    }
  }
}
