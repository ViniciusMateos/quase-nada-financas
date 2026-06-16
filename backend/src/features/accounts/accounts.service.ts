import { AccountsRepository } from "./accounts.repository.js";
import { PluggyClient } from "../../integrations/pluggy.client.js";
import { TransactionsService } from "../transactions/transactions.service.js";
import { prisma } from "../../config/database.js";
import { redis } from "../../lib/redis.js";
import { Errors } from "../../lib/errors.js";
import { detectInstitutionName } from "./detect-institution.js";
import { INTERNAL_TRANSFER_CATEGORY_ID } from "../categories/categories.seed.js";
import type { BankAccount, ConnectedAccount } from "@prisma/client";

/** Conta conectada com sub-contas + campos de fatura calculados (cartão). */
type AccountWithBankAccounts = ConnectedAccount & {
  bankAccounts: Array<
    BankAccount & {
      currentStatementAmount?: number;
      statementClosedAmount?: number;
      statementOpenAmount?: number;
      statementDueDate?: string | null;
    }
  >;
};

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
        minimumPayment: acc.creditData?.minimumPayment ?? null,
        creditLimit: acc.creditData?.creditLimit ?? null,
        creditBrand: acc.creditData?.brand ?? null,
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
   * Para cada BankAccount type=CREDIT, calcula os números da fatura. Quando o
   * `creditCloseDay` está configurado (dia do mês 1-31), produz:
   *
   *   - statementClosedAmount: fatura que JÁ FECHOU e está a pagar
   *     janela = [fechamento anterior, último fechamento)
   *   - statementOpenAmount: fatura nova, ainda acumulando
   *     janela = [último fechamento, now]
   *   - statementDueDate: vencimento da fatura fechada, derivado do creditDueDay
   *     (cai pro balanceDueDate da Pluggy quando não há creditDueDay)
   *   - currentStatementAmount = statementClosedAmount (o boleto a pagar)
   *
   * Sem `creditCloseDay`, cai no fallback antigo (desde último pagamento, ou
   * balance cru) só pra `currentStatementAmount`.
   *
   * Parcelas futuras (occurredAt > now) ficam fora das duas janelas — entram só
   * na fatura do mês em que serão cobradas. `minimumPayment`/`creditLimit`/
   * `creditBrand`/`balance` já vêm no registro e seguem pro payload.
   */
  private async enrichWithCurrentStatement(
    accounts: AccountWithBankAccounts[]
  ): Promise<AccountWithBankAccounts[]> {
    const creditAccounts = accounts.flatMap((c) =>
      c.bankAccounts.filter((ba) => ba.type === "CREDIT")
    );
    if (creditAccounts.length === 0) return accounts;

    const now = new Date();

    const entries = await Promise.all(
      creditAccounts.map(async (ba) => {
        // Caminho principal: closeDay configurado → fatura fechada + aberta + vencimento.
        if (ba.creditCloseDay && ba.creditCloseDay >= 1 && ba.creditCloseDay <= 31) {
          const lastClose = lastCloseDateFromCloseDay(ba.creditCloseDay, now);
          const prevClose = prevCloseDateFromCloseDay(ba.creditCloseDay, lastClose);
          const [closedAgg, openAgg] = await Promise.all([
            prisma.transaction.aggregate({
              where: {
                bankAccountId: ba.id,
                occurredAt: { gte: prevClose, lt: lastClose },
                categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
              },
              _sum: { amount: true },
            }),
            prisma.transaction.aggregate({
              where: {
                bankAccountId: ba.id,
                occurredAt: { gte: lastClose, lte: now },
                categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
              },
              _sum: { amount: true },
            }),
          ]);
          const closed = Math.abs(closedAgg._sum.amount ?? 0);
          const open = Math.abs(openAgg._sum.amount ?? 0);
          const dueDate = dueDateForStatement(ba.creditCloseDay, ba.creditDueDay, lastClose, ba.creditDueDate);
          return {
            id: ba.id,
            currentStatementAmount: closed,
            statementClosedAmount: closed,
            statementOpenAmount: open,
            statementDueDate: dueDate ? dueDate.toISOString() : null,
          } as const;
        }

        // Fallback: sem closeDay → desde último pagamento, ou balance cru.
        const lastPayment = await prisma.transaction.findFirst({
          where: { bankAccountId: ba.id, categoryId: INTERNAL_TRANSFER_CATEGORY_ID },
          orderBy: { occurredAt: "desc" },
          select: { occurredAt: true },
        });
        if (!lastPayment) {
          return {
            id: ba.id,
            currentStatementAmount: ba.balance,
            statementClosedAmount: undefined,
            statementOpenAmount: undefined,
            statementDueDate: ba.creditDueDate ? ba.creditDueDate.toISOString() : null,
          } as const;
        }
        const agg = await prisma.transaction.aggregate({
          where: {
            bankAccountId: ba.id,
            occurredAt: { gt: lastPayment.occurredAt, lte: now },
            categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
          },
          _sum: { amount: true },
        });
        return {
          id: ba.id,
          currentStatementAmount: Math.abs(agg._sum.amount ?? 0),
          statementClosedAmount: undefined,
          statementOpenAmount: undefined,
          statementDueDate: ba.creditDueDate ? ba.creditDueDate.toISOString() : null,
        } as const;
      })
    );
    const byBA = new Map(entries.map((e) => [e.id, e]));

    return accounts.map((c) => ({
      ...c,
      bankAccounts: c.bankAccounts.map((ba) => {
        if (ba.type !== "CREDIT") return ba;
        const e = byBA.get(ba.id);
        return e
          ? {
              ...ba,
              currentStatementAmount: e.currentStatementAmount,
              statementClosedAmount: e.statementClosedAmount,
              statementOpenAmount: e.statementOpenAmount,
              statementDueDate: e.statementDueDate,
            }
          : ba;
      }),
    }));
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

  /** Configura o dia de vencimento manual de um cartão (1-31). null pra remover. */
  async setCreditDueDay(userId: string, bankAccountId: string, creditDueDay: number | null) {
    const ba = await this.repo.findBankAccountById(bankAccountId);
    if (!ba) throw Errors.NotFound("Conta não encontrada");
    if (ba.type !== "CREDIT") throw Errors.Validation("creditDueDay só se aplica a cartão de crédito");
    const conn = await this.repo.findConnectedAccountById(ba.connectedAccountId);
    if (!conn || conn.userId !== userId) throw Errors.NotFound("Conta não encontrada");
    if (creditDueDay !== null && (creditDueDay < 1 || creditDueDay > 31 || !Number.isInteger(creditDueDay))) {
      throw Errors.Validation("creditDueDay deve ser inteiro entre 1 e 31");
    }
    await this.repo.setBankAccountCreditDueDay(bankAccountId, creditDueDay);
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
        minimumPayment: acc.creditData?.minimumPayment ?? null,
        creditLimit: acc.creditData?.creditLimit ?? null,
        creditBrand: acc.creditData?.brand ?? null,
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

/**
 * Início do fechamento ANTERIOR ao `lastClose` (um ciclo pra trás), clampando
 * pro último dia quando o mês não tem o `closeDay`. Define o começo da janela
 * da fatura que acabou de fechar.
 */
function prevCloseDateFromCloseDay(closeDay: number, lastClose: Date): Date {
  let y = lastClose.getUTCFullYear();
  let m = lastClose.getUTCMonth() - 1;
  if (m < 0) {
    m = 11;
    y -= 1;
  }
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(closeDay, daysInMonth), 0, 0, 0, 0));
}

/**
 * Vencimento da fatura que fechou em `lastClose`, derivado do `dueDay` (1-31):
 * a próxima ocorrência do dia de vencimento no/depois do fechamento. Se o
 * `dueDay >= closeDay`, vence no mesmo mês do fechamento; senão, no mês seguinte.
 * Sem `dueDay`, cai pro `fallback` (balanceDueDate da Pluggy, que pode atrasar).
 */
function dueDateForStatement(
  closeDay: number,
  dueDay: number | null | undefined,
  lastClose: Date,
  fallback: Date | null | undefined
): Date | null {
  if (!dueDay || dueDay < 1 || dueDay > 31) return fallback ?? null;
  let y = lastClose.getUTCFullYear();
  let m = lastClose.getUTCMonth();
  if (dueDay < closeDay) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(dueDay, daysInMonth), 0, 0, 0, 0));
}

