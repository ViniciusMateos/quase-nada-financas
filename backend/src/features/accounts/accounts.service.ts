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
      const bill = await this.fetchLatestBill(acc);
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
        billAmount: bill.billAmount,
        billDueDate: bill.billDueDate,
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

  /** Fatura mais recente (Pluggy /bills) de um cartão: a de maior dueDate. */
  private async fetchLatestBill(acc: { id: string; type?: string }): Promise<{ billAmount: number | null; billDueDate: Date | null }> {
    if (acc.type !== "CREDIT") return { billAmount: null, billDueDate: null };
    const bills = await this.pluggy.listBills(acc.id).catch(() => []);
    let latest: { totalAmount?: number; dueDate?: string } | null = null;
    for (const b of bills) {
      if (!b.dueDate) continue;
      if (!latest || b.dueDate > (latest.dueDate ?? "")) latest = b;
    }
    return { billAmount: latest?.totalAmount ?? null, billDueDate: parsePluggyDate(latest?.dueDate) };
  }

  /**
   * Soma das PARCELAS que caem na fatura do mês-alvo (year*12+mês), PROJETANDO
   * o plano inteiro a partir dos dados que temos — sem depender do Pluggy ter
   * publicado a parcela. Reconstrói cada plano (por descrição normalizada +
   * total), ancora numa parcela conhecida pra achar o mês da parcela 1, e gera
   * a parcela do mês-alvo se ela existir no plano. Usa o valor da parcela mais
   * recente conhecida (a 1ª às vezes tem centavo diferente por arredondamento).
   */
  private async projectInstallmentsForFatura(
    bankAccountId: string,
    closeDay: number,
    targetMonthIndex: number
  ): Promise<{ sum: number; hasPlan: boolean }> {
    const txs = await prisma.transaction.findMany({
      where: { bankAccountId, installmentTotal: { not: null }, installmentCurrent: { not: null } },
      select: { description: true, amount: true, installmentCurrent: true, installmentTotal: true, occurredAt: true },
    });
    if (txs.length === 0) return { sum: 0, hasPlan: false };

    type Plan = { total: number; lowNum: number; lowMonthIdx: number; highNum: number; amount: number };
    const plans = new Map<string, Plan>();
    for (const tx of txs) {
      const total = tx.installmentTotal as number;
      const num = tx.installmentCurrent as number;
      const monthIdx = faturaCloseMonthIndex(tx.occurredAt, closeDay);
      // Chave robusta a duplicata do MeuPluggy (mesma compra com descrição
      // levemente diferente: "Eventim *Eve" vs "*Eventim", " AIRBNB" vs "AIRBNB"):
      // 1ª palavra da descrição + total + valor arredondado. Colapsa as variações.
      const firstToken = (tx.description ?? "").toLowerCase().replace(/\s+/g, " ").trim().split(/[ *]/)[0] || "?";
      const key = `${firstToken}|${total}|${Math.round(Math.abs(tx.amount))}`;
      const cur = plans.get(key);
      if (!cur) {
        plans.set(key, { total, lowNum: num, lowMonthIdx: monthIdx, highNum: num, amount: Math.abs(tx.amount) });
      } else {
        if (num < cur.lowNum) { cur.lowNum = num; cur.lowMonthIdx = monthIdx; }
        if (num >= cur.highNum) { cur.highNum = num; cur.amount = Math.abs(tx.amount); }
      }
    }

    let sum = 0;
    for (const [, p] of plans) {
      const firstMonthIdx = p.lowMonthIdx - (p.lowNum - 1); // mês da fatura da parcela 1
      const parcelaNum = targetMonthIndex - firstMonthIdx + 1;
      if (parcelaNum >= 1 && parcelaNum <= p.total) sum += p.amount;
    }
    return { sum: Math.round(sum * 100) / 100, hasPlan: plans.size > 0 };
  }

  /**
   * Para cada BankAccount type=CREDIT define os números da fatura:
   *
   *   - currentStatementAmount = fatura A PAGAR (fechada). Prioridade:
   *       1) bill oficial do Pluggy (/bills) se o vencimento ainda não passou;
   *       2) cálculo NOSSO = à vista (Pluggy) + parcelas PROJETADAS por nós
   *          (pra cartão com parcelamento — cobre o buraco do MeuPluggy que não
   *          publica as parcelas da fatura corrente);
   *       3) balance (limite utilizado) pra cartão sem parcelamento.
   *   - statementOpenAmount = fatura ABERTA = à vista do ciclo novo + parcelas
   *     projetadas que caem nele.
   *   - statementDueDate = bill; senão derivado de creditCloseDay + creditDueDay.
   *
   * Ruído irredutível: compras no PRÓPRIO dia do fechamento podem cair na
   * fatura seguinte (o banco corta por horário; só temos a data). É pequeno.
   */
  private async enrichWithCurrentStatement(accounts: AccountWithBankAccounts[]): Promise<AccountWithBankAccounts[]> {
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const DAY = 86_400_000;

    const creditBAs = accounts.flatMap((c) => c.bankAccounts.filter((ba) => ba.type === "CREDIT"));
    const calcByBA = new Map<string, { closed: number; open: number; useComputed: boolean }>();
    await Promise.all(
      creditBAs.map(async (ba) => {
        if (!ba.creditCloseDay || ba.creditCloseDay < 1 || ba.creditCloseDay > 31) {
          calcByBA.set(ba.id, { closed: 0, open: 0, useComputed: false });
          return;
        }
        const closeDay = ba.creditCloseDay;
        const lastClose = lastCloseDateFromCloseDay(closeDay, now);
        const prevClose = prevCloseDateFromCloseDay(closeDay, lastClose);
        const nextClose = nextCloseDateFromCloseDay(closeDay, lastClose);
        // à vista (não-parcela); parcelas entram via projeção, sem depender do Pluggy.
        const avistaWhere = (from: Date, to: Date) => ({
          bankAccountId: ba.id,
          amount: { lt: 0 } as const,
          installmentTotal: null,
          occurredAt: { gte: from, lt: to },
          categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
        });
        const [avClosed, avOpen, projClosed, projOpen] = await Promise.all([
          prisma.transaction.aggregate({ where: avistaWhere(new Date(prevClose.getTime() + DAY), new Date(lastClose.getTime() + DAY)), _sum: { amount: true } }),
          prisma.transaction.aggregate({ where: avistaWhere(new Date(lastClose.getTime() + DAY), new Date(nextClose.getTime() + DAY)), _sum: { amount: true } }),
          this.projectInstallmentsForFatura(ba.id, closeDay, monthIndex(lastClose)),
          this.projectInstallmentsForFatura(ba.id, closeDay, monthIndex(nextClose)),
        ]);
        calcByBA.set(ba.id, {
          closed: Math.round((Math.abs(avClosed._sum.amount ?? 0) + projClosed.sum) * 100) / 100,
          open: Math.round((Math.abs(avOpen._sum.amount ?? 0) + projOpen.sum) * 100) / 100,
          // Só usa o cálculo pra "a pagar" quando há parcela caindo NESTA fatura
          // (aí o balance está inflado por parcelas futuras). Sem parcela na
          // fatura (ex: Nubank), o balance é mais confiável que o à vista.
          useComputed: projClosed.sum > 0.005,
        });
      })
    );

    return accounts.map((c) => ({
      ...c,
      bankAccounts: c.bankAccounts.map((ba) => {
        if (ba.type !== "CREDIT") return ba;
        const calc = calcByBA.get(ba.id) ?? { closed: 0, open: 0, useComputed: false };

        let statementDueDate: string | null = ba.creditDueDate ? ba.creditDueDate.toISOString() : null;
        if (ba.creditCloseDay && ba.creditCloseDay >= 1 && ba.creditCloseDay <= 31) {
          const lastClose = lastCloseDateFromCloseDay(ba.creditCloseDay, now);
          const dd = dueDateForStatement(ba.creditCloseDay, ba.creditDueDay, lastClose, ba.creditDueDate);
          if (dd) statementDueDate = dd.toISOString();
        }

        let currentStatementAmount: number;
        if (ba.billAmount != null && ba.billDueDate && ba.billDueDate >= startOfToday) {
          currentStatementAmount = ba.billAmount; // 1) bill oficial fresco
          statementDueDate = ba.billDueDate.toISOString();
        } else if (calc.useComputed) {
          currentStatementAmount = calc.closed; // 2) à vista + parcelas projetadas
        } else {
          currentStatementAmount = ba.balance; // 3) sem parcelamento → limite utilizado
        }

        return { ...ba, currentStatementAmount, statementDueDate, statementOpenAmount: calc.open };
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
      // Janela ROLANTE de 90 dias (não incremental desde lastSyncAt). O Pluggy
      // às vezes adiciona transações com data no passado DEPOIS de já termos
      // avançado o lastSyncAt — a busca por data (`from`) nunca as pegaria e elas
      // sumiam (ex: Nubank parando numa data antiga). Como o ingest deduplica por
      // externalId, re-buscar 90 dias a cada sync é seguro e completa os buracos.
      const since = new Date(Date.now() - 90 * 86_400_000);
      const bill = await this.fetchLatestBill(acc);

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
        billAmount: bill.billAmount,
        billDueDate: bill.billDueDate,
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

/** Índice de mês contínuo (ano*12 + mês 0-11), pra comparar meses de fatura. */
function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/**
 * Mês (índice contínuo) da FATURA que cobra uma transação na data `date`, dado
 * o `closeDay`: se o dia da compra é > closeDay, cai na fatura do mês seguinte;
 * senão, na fatura do próprio mês. (Ex: fecha dia 9 → compra em 20/07 cai na
 * fatura de agosto.)
 */
function faturaCloseMonthIndex(date: Date, closeDay: number): number {
  const bump = date.getUTCDate() > closeDay ? 1 : 0;
  return date.getUTCFullYear() * 12 + date.getUTCMonth() + bump;
}

/**
 * Início do fechamento ANTERIOR ao `lastClose` (um ciclo pra trás), clampando
 * pro último dia do mês quando não existe o `closeDay`. Começo da janela da
 * fatura que fechou.
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
 * Próximo fechamento DEPOIS de `lastClose` (um ciclo à frente), clampando pro
 * último dia do mês quando não existe o `closeDay`. Define o fim da janela da
 * fatura aberta (a que está acumulando).
 */
function nextCloseDateFromCloseDay(closeDay: number, lastClose: Date): Date {
  let y = lastClose.getUTCFullYear();
  let m = lastClose.getUTCMonth() + 1;
  if (m > 11) {
    m = 0;
    y += 1;
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

