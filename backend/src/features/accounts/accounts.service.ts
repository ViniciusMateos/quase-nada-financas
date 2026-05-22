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

  async createPluggyConnectToken(
    userId: string,
    oauthRedirectUri?: string
  ): Promise<{ token: string; meuPluggyConnectorId: number }> {
    const [token, meuPluggyConnectorId] = await Promise.all([
      this.pluggy.createConnectToken(userId, oauthRedirectUri),
      this.pluggy.getMeuPluggyConnectorId(),
    ]);
    return { token, meuPluggyConnectorId };
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

    const investments = await this.pluggy.listInvestments(itemId);
    await this.repo.setInvestmentFlag(connected.id, isPureInvestment(accounts, investments.length));

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
   * (fatura aberta) em camadas:
   *
   *   1. `creditCloseDay` configurado pelo usuário (dia do mês 1-31):
   *      janela = [último fechamento passado, now]
   *   2. Última transação "Pagamento de fatura" do cartão:
   *      janela = [data do pagamento, now]
   *   3. Sem nada: fallback = balance cru da Pluggy
   */
  private async enrichWithCurrentStatement<
    T extends {
      bankAccounts: Array<{
        id: string;
        type: string;
        balance: number;
        creditCloseDay?: number | null;
      }>;
    }
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

    const entries = await Promise.all(
      creditAccounts.map(async (ba) => {
        // Camada 1: closeDay manual.
        if (ba.creditCloseDay && ba.creditCloseDay >= 1 && ba.creditCloseDay <= 31) {
          const start = lastCloseDateFromCloseDay(ba.creditCloseDay, now);
          const agg = await prisma.transaction.aggregate({
            where: {
              bankAccountId: ba.id,
              occurredAt: { gte: start, lte: now },
              categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
            },
            _sum: { amount: true },
          });
          return [ba.id, Math.abs(agg._sum.amount ?? 0)] as const;
        }

        // Camada 2: desde último Pagamento de fatura.
        const lastPayment = await prisma.transaction.findFirst({
          where: {
            bankAccountId: ba.id,
            categoryId: INTERNAL_TRANSFER_CATEGORY_ID,
          },
          orderBy: { occurredAt: "desc" },
          select: { occurredAt: true },
        });
        if (!lastPayment) {
          // Camada 3: balance cru.
          return [ba.id, ba.balance] as const;
        }
        const agg = await prisma.transaction.aggregate({
          where: {
            bankAccountId: ba.id,
            occurredAt: { gt: lastPayment.occurredAt, lte: now },
            categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
          },
          _sum: { amount: true },
        });
        return [ba.id, Math.abs(agg._sum.amount ?? 0)] as const;
      })
    );
    const amountByBA = new Map(entries);

    return accounts.map((c) => ({
      ...c,
      bankAccounts: c.bankAccounts.map((ba) =>
        ba.type === "CREDIT"
          ? { ...ba, currentStatementAmount: amountByBA.get(ba.id) ?? ba.balance }
          : ba
      ),
    })) as Array<T & { bankAccounts: Array<T["bankAccounts"][number] & { currentStatementAmount?: number }> }>;
  }

  /**
   * Configura o dia de fechamento manual de um cartão (1-31).
   * Passar null pra remover.
   */
  async setCreditCloseDay(
    userId: string,
    bankAccountId: string,
    creditCloseDay: number | null
  ) {
    const ba = await this.repo.findBankAccountById(bankAccountId);
    if (!ba) throw Errors.NotFound("Conta não encontrada");
    if (ba.type !== "CREDIT") throw Errors.Validation("creditCloseDay só se aplica a cartão de crédito");
    // Garante que o user é dono via ConnectedAccount
    const conn = await this.repo.findConnectedAccountById(ba.connectedAccountId);
    if (!conn || conn.userId !== userId) throw Errors.NotFound("Conta não encontrada");
    if (creditCloseDay !== null && (creditCloseDay < 1 || creditCloseDay > 31 || !Number.isInteger(creditCloseDay))) {
      throw Errors.Validation("creditCloseDay deve ser inteiro entre 1 e 31");
    }
    await this.repo.setBankAccountCreditCloseDay(bankAccountId, creditCloseDay);
    await this.invalidateDashboardCache(userId);
    return { ok: true };
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

    // Marca como corretora se tiver investimentos (exclui do saldo/transações).
    const investments = await this.pluggy.listInvestments(conn.pluggyItemId);
    await this.repo.setInvestmentFlag(conn.id, isPureInvestment(remoteAccounts, investments.length));

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

/**
 * Decide se a conta conectada é uma corretora "pura" (deve sumir do saldo e
 * das transações). Só é considerada investimento se tiver investimentos E
 * NÃO tiver cartão de crédito: bancos como o Nubank têm "caixinha" (que vem
 * como investimento) mas continuam sendo conta de gastos — devem aparecer nas
 * Contas, com a caixinha aparecendo só na aba Ativos. Corretoras (XP, Rico)
 * não emitem cartão de crédito.
 */
function isPureInvestment(accounts: Array<{ type?: string }>, investmentCount: number): boolean {
  if (investmentCount === 0) return false;
  const hasCreditCard = accounts.some((a) => a.type === "CREDIT");
  return !hasCreditCard;
}

/** Pluggy retorna datas como ISO string ou yyyy-MM-dd. Retorna null se inválido. */
function parsePluggyDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Dado um dia do mês (1-31) configurado pelo usuário, retorna o INÍCIO do
 * dia de fechamento mais recente (passado ou hoje). A janela da fatura
 * aberta usa `gte` esse valor — convenção: compras feitas NO dia do
 * fechamento contam pra fatura nova (mesmo que estejam fechando o mês).
 *
 * Ex: hoje = 19/05, closeDay = 9 → retorna 09/05 00:00:00.
 * Ex: hoje = 05/05, closeDay = 9 → retorna 09/04 00:00:00.
 * Se o mês não tem o dia (ex: closeDay=31 em fev), usa o último do mês.
 */
function lastCloseDateFromCloseDay(closeDay: number, now: Date): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed
  const todayDay = now.getUTCDate();
  let refYear = year;
  let refMonth = month;
  if (todayDay < closeDay) {
    refMonth -= 1;
    if (refMonth < 0) {
      refMonth = 11;
      refYear -= 1;
    }
  }
  const daysInRefMonth = new Date(Date.UTC(refYear, refMonth + 1, 0)).getUTCDate();
  const effectiveDay = Math.min(closeDay, daysInRefMonth);
  return new Date(Date.UTC(refYear, refMonth, effectiveDay, 0, 0, 0, 0));
}

