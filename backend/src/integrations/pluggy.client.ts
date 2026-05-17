import { request } from "undici";
import { env } from "../config/env.js";

import { Errors } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

export interface PluggyAccount {
  id: string;
  type?: string;
  balance?: number;
  currencyCode?: string;
}

export interface PluggyTransaction {
  id: string;
  date: string;
  amount: number;
  currencyCode?: string;
  description?: string;
  merchant?: { name?: string; mcc?: string };
  paymentData?: { paymentMethod?: string };
  creditCardMetadata?: { installmentNumber?: number; totalInstallments?: number };
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

export class PluggyClient {
  private apiKeyCache: { key: string; expiresAt: number } | null = null;

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
