import { AccountsRepository } from "./accounts.repository.js";
import { PluggyClient } from "../../integrations/pluggy.client.js";
import { TransactionsService } from "../transactions/transactions.service.js";
import { redis } from "../../lib/redis.js";
import { Errors } from "../../lib/errors.js";

export class AccountsService {
  private readonly repo = new AccountsRepository();
  private readonly pluggy = new PluggyClient();
  private readonly txService = new TransactionsService();

  async createPluggyConnectToken(userId: string, oauthRedirectUri?: string): Promise<string> {
    return this.pluggy.createConnectToken(userId, oauthRedirectUri);
  }

  async handlePluggyCallback(userId: string, itemId: string) {
    const item = await this.pluggy.getItem(itemId);
    const accounts = await this.pluggy.listAccounts(itemId);

    const connected = await this.repo.upsertConnectedAccount({
      userId,
      pluggyItemId: itemId,
      bankName: item.connector?.name ?? "Banco",
      logoUrl: item.connector?.imageUrl ?? null,
      primaryColor: item.connector?.primaryColor ?? null,
      consentExpiresAt: item.consentExpiresAt ? new Date(item.consentExpiresAt) : null,
      status: "ACTIVE",
    });

    for (const acc of accounts) {
      const bankAccount = await this.repo.upsertBankAccount({
        connectedAccountId: connected.id,
        externalId: acc.id,
        type: acc.type ?? "UNKNOWN",
        balance: acc.balance ?? 0,
        currency: acc.currencyCode ?? "BRL",
        lastSyncAt: new Date(),
      });

      // Sincroniza últimos 90 dias na primeira carga
      const since = new Date(Date.now() - 90 * 86_400_000);
      const txs = await this.pluggy.listTransactions(acc.id, since);
      await this.txService.ingestTransactions(userId, bankAccount.id, txs);
    }

    await this.invalidateDashboardCache(userId);
    return { connectedAccountId: connected.id, bankName: connected.bankName };
  }

  async listAccounts(userId: string, forceSync: boolean) {
    if (forceSync) {
      const connectedList = await this.repo.findConnectedAccountsByUser(userId);
      for (const conn of connectedList) {
        await this.syncAccount(userId, conn.id);
      }
    }
    return this.repo.findAccountsWithBankAccounts(userId);
  }

  async removeAccount(userId: string, connectedAccountId: string): Promise<void> {
    const conn = await this.repo.findConnectedAccountById(connectedAccountId);
    if (!conn || conn.userId !== userId) throw Errors.NotFound("Conta não encontrada");
    await this.pluggy.deleteItem(conn.pluggyItemId).catch(() => undefined);
    await this.repo.deleteConnectedAccount(connectedAccountId);
    await this.invalidateDashboardCache(userId);
  }

  async syncAccount(userId: string, connectedAccountId: string) {
    const conn = await this.repo.findConnectedAccountById(connectedAccountId);
    if (!conn || conn.userId !== userId) throw Errors.NotFound("Conta não encontrada");

    // Atualiza logoUrl/primaryColor a cada sync (Pluggy pode trocar)
    const item = await this.pluggy.getItem(conn.pluggyItemId).catch(() => null);
    if (item?.connector) {
      await this.repo.upsertConnectedAccount({
        userId,
        pluggyItemId: conn.pluggyItemId,
        bankName: item.connector.name ?? conn.bankName,
        logoUrl: item.connector.imageUrl ?? null,
        primaryColor: item.connector.primaryColor ?? null,
        consentExpiresAt: item.consentExpiresAt ? new Date(item.consentExpiresAt) : null,
        status: "ACTIVE",
      });
    }

    const remoteAccounts = await this.pluggy.listAccounts(conn.pluggyItemId);
    let totalNewTx = 0;

    for (const acc of remoteAccounts) {
      const previous = await this.repo.findBankAccountByExternal(conn.id, acc.id);
      const since = previous?.lastSyncAt ?? new Date(Date.now() - 90 * 86_400_000);

      const bankAccount = await this.repo.upsertBankAccount({
        connectedAccountId: conn.id,
        externalId: acc.id,
        type: acc.type ?? "UNKNOWN",
        balance: acc.balance ?? 0,
        currency: acc.currencyCode ?? "BRL",
        lastSyncAt: new Date(),
      });

      const txs = await this.pluggy.listTransactions(acc.id, since);
      const ingested = await this.txService.ingestTransactions(userId, bankAccount.id, txs);
      totalNewTx += ingested;
    }

    await this.repo.touchConnectedAccount(conn.id);
    await this.invalidateDashboardCache(userId);
    return { syncedAt: new Date().toISOString(), newTransactions: totalNewTx };
  }

  private async invalidateDashboardCache(userId: string): Promise<void> {
    const keys = await redis.keys(`dashboard:${userId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  }
}
