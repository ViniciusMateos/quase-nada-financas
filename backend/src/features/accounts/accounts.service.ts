import { AccountsRepository } from "./accounts.repository.js";
import { PluggyClient } from "../../integrations/pluggy.client.js";
import { TransactionsService } from "../transactions/transactions.service.js";
import { prisma } from "../../config/database.js";
import { redis } from "../../lib/redis.js";
import { Errors } from "../../lib/errors.js";
import { detectInstitutionName } from "./detect-institution.js";
import { INTERNAL_TRANSFER_CATEGORY_ID } from "../categories/categories.seed.js";

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
        subtype: acc.subtype ?? null,
        name: acc.name ?? null,
        marketingName: acc.marketingName ?? null,
        number: acc.number ?? null,
        balance: acc.balance ?? 0,
        currency: acc.currencyCode ?? "BRL",
        lastSyncAt: new Date(),
        creditCloseDate: parsePluggyDate(acc.creditData?.balanceCloseDate),
        creditDueDate: parsePluggyDate(acc.creditData?.balanceDueDate),
      });

      // Sincroniza últimos 90 dias na primeira carga
      const since = new Date(Date.now() - 90 * 86_400_000);
      const txs = await this.pluggy.listTransactions(acc.id, since);
      await this.txService.ingestTransactions(userId, bankAccount.id, txs);
    }

    if (!connected.customName) {
      const detected = detectInstitutionName(accounts);
      if (detected) await this.repo.setCustomName(connected.id, detected);
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
    const accounts = await this.repo.findAccountsWithBankAccounts(userId);
    return this.enrichWithCurrentStatement(accounts);
  }

  /**
   * Para cada BankAccount type=CREDIT, calcula `currentStatementAmount`
   * (fatura aberta) somando o valor absoluto das transactions do ciclo atual,
   * excluindo "Pagamento de fatura" (transferência interna).
   *
   * Janela do ciclo:
   *  - Com creditCloseDate persistido (Pluggy normalmente envia o PRÓXIMO
   *    fechamento):
   *    - closeDate futuro: ciclo atual = [closeDate - 30d, now]
   *    - closeDate passado: ciclo atual = [closeDate, now]
   *  - Sem creditCloseDate (fallback): início do mês UTC até now.
   */
  private async enrichWithCurrentStatement<
    T extends { bankAccounts: Array<{ id: string; type: string; creditCloseDate?: Date | null }> }
  >(
    accounts: T[]
  ): Promise<Array<T & { bankAccounts: Array<T["bankAccounts"][number] & { currentStatementAmount?: number }> }>> {
    const creditAccounts = accounts.flatMap((c) =>
      c.bankAccounts.filter((ba) => ba.type === "CREDIT")
    );
    if (creditAccounts.length === 0) {
      return accounts as Array<T & { bankAccounts: Array<T["bankAccounts"][number] & { currentStatementAmount?: number }> }>;
    }

    const now = new Date();
    const fallbackStart = new Date();
    fallbackStart.setUTCDate(1);
    fallbackStart.setUTCHours(0, 0, 0, 0);

    // Uma query por bank account (em paralelo), pois cada um pode ter ciclo diferente.
    const entries = await Promise.all(
      creditAccounts.map(async (ba) => {
        const { start, end } = openStatementWindow(ba.creditCloseDate ?? null, now, fallbackStart);
        const agg = await prisma.transaction.aggregate({
          where: {
            bankAccountId: ba.id,
            occurredAt: { gte: start, lte: end },
            categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
          },
          _sum: { amount: true },
        });
        return [ba.id, Math.abs(agg._sum.amount ?? 0)] as const;
      })
    );
    const sumByBA = new Map(entries);

    return accounts.map((c) => ({
      ...c,
      bankAccounts: c.bankAccounts.map((ba) =>
        ba.type === "CREDIT"
          ? { ...ba, currentStatementAmount: sumByBA.get(ba.id) ?? 0 }
          : ba
      ),
    })) as Array<T & { bankAccounts: Array<T["bankAccounts"][number] & { currentStatementAmount?: number }> }>;
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
        subtype: acc.subtype ?? null,
        name: acc.name ?? null,
        marketingName: acc.marketingName ?? null,
        number: acc.number ?? null,
        balance: acc.balance ?? 0,
        currency: acc.currencyCode ?? "BRL",
        lastSyncAt: new Date(),
        creditCloseDate: parsePluggyDate(acc.creditData?.balanceCloseDate),
        creditDueDate: parsePluggyDate(acc.creditData?.balanceDueDate),
      });

      const txs = await this.pluggy.listTransactions(acc.id, since);
      const ingested = await this.txService.ingestTransactions(userId, bankAccount.id, txs);
      totalNewTx += ingested;
    }

    if (!conn.customName) {
      const detected = detectInstitutionName(remoteAccounts);
      if (detected) await this.repo.setCustomName(conn.id, detected);
    }

    await this.repo.touchConnectedAccount(conn.id);
    await this.invalidateDashboardCache(userId);
    return { syncedAt: new Date().toISOString(), newTransactions: totalNewTx };
  }

  async renameAccount(userId: string, connectedAccountId: string, customName: string | null) {
    const conn = await this.repo.findConnectedAccountById(connectedAccountId);
    if (!conn || conn.userId !== userId) throw Errors.NotFound("Conta não encontrada");
    const trimmed = customName?.trim();
    return this.repo.setCustomName(connectedAccountId, trimmed ? trimmed : null);
  }

  private async invalidateDashboardCache(userId: string): Promise<void> {
    const keys = await redis.keys(`dashboard:${userId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  }
}

/** Pluggy retorna datas como ISO string ou yyyy-MM-dd. Retorna null se inválido. */
function parsePluggyDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calcula a janela [start, end] da fatura aberta atual usando creditCloseDate.
 * - Sem closeDate: fallback (início do mês UTC).
 * - closeDate futuro (próximo fechamento): ciclo atual = [closeDate - 30d, now]
 * - closeDate passado (já fechou): ciclo atual = [closeDate, now]
 */
function openStatementWindow(
  closeDate: Date | null,
  now: Date,
  fallbackStart: Date
): { start: Date; end: Date } {
  if (!closeDate) return { start: fallbackStart, end: now };
  if (closeDate.getTime() > now.getTime()) {
    const start = new Date(closeDate);
    start.setUTCDate(start.getUTCDate() - 30);
    return { start, end: now };
  }
  return { start: closeDate, end: now };
}
