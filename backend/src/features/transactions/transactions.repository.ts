import { prisma } from "../../config/database.js";
import type { Prisma, Transaction, CategoryRule } from "@prisma/client";
import { INTERNAL_TRANSFER_CATEGORY_ID } from "../categories/categories.seed.js";

interface PageQuery {
  userId: string;
  limit: number;
  accountId?: string;
  accountIds?: string[];
  accountType?: 'BANK' | 'CREDIT';
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  cursor?: { id: string; occurredAt: string };
}

export class TransactionsRepository {
  async findTransactionsPage(q: PageQuery) {
    const where: Prisma.TransactionWhereInput = {
      bankAccount: q.accountType
        ? { type: q.accountType, connectedAccount: { userId: q.userId, isInvestment: false } }
        : { connectedAccount: { userId: q.userId, isInvestment: false } },
    };
    if (q.accountId) where.bankAccountId = q.accountId;
    else if (q.accountIds && q.accountIds.length > 0) where.bankAccountId = { in: q.accountIds };
    if (q.categoryId) {
      where.categoryId = q.categoryId;
    } else {
      // Esconde "Pagamento de fatura" da listagem geral. Só aparece se o user
      // filtrar explicitamente por essa categoria (drill-down).
      where.categoryId = { not: INTERNAL_TRANSFER_CATEGORY_ID };
    }
    if (q.startDate || q.endDate) {
      where.occurredAt = {
        ...(q.startDate ? { gte: q.startDate } : {}),
        ...(q.endDate ? { lte: q.endDate } : {}),
      };
    }
    if (q.cursor) {
      const cursorDate = new Date(q.cursor.occurredAt);
      where.OR = [
        { occurredAt: { lt: cursorDate } },
        { occurredAt: cursorDate, id: { lt: q.cursor.id } },
      ];
    }

    return prisma.transaction.findMany({
      where,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: q.limit,
      include: {
        category: true,
        bankAccount: { include: { connectedAccount: true } },
      },
    });
  }

  findTransactionByIdForUser(userId: string, id: string): Promise<Transaction | null> {
    return prisma.transaction.findFirst({
      where: { id, bankAccount: { connectedAccount: { userId } } },
    });
  }

  findTransactionByExternalId(bankAccountId: string, externalId: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({
      where: { bankAccountId_externalId: { bankAccountId, externalId } },
    });
  }

  findCategoryForUser(userId: string, categoryId: string) {
    return prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ isDefault: true }, { userId }],
      },
    });
  }

  updateTransactionCategory(transactionId: string, categoryId: string): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: { categoryId },
    });
  }

  updateTransactionFields(
    transactionId: string,
    data: { alias?: string | null; categoryId?: string; isSubscriptionOverride?: boolean | null }
  ): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id: transactionId },
      data,
    });
  }

  /**
   * Aplica os mesmos campos em todas as transações do user que "batem" com a
   * transação de referência (mesmo merchantName, ou se merchant for null, mesma
   * description normalizada — sem números/parcelas no fim).
   */
  async updateSimilarTransactions(
    userId: string,
    referenceTxId: string,
    matchBy: { merchantName: string | null; description: string | null },
    data: { alias?: string | null; categoryId?: string; isSubscriptionOverride?: boolean | null }
  ): Promise<number> {
    const where: Prisma.TransactionWhereInput = {
      id: { not: referenceTxId },
      bankAccount: { connectedAccount: { userId } },
    };
    if (matchBy.merchantName) {
      where.merchantName = { equals: matchBy.merchantName, mode: "insensitive" };
    } else if (matchBy.description) {
      const cleaned = matchBy.description.replace(/\s+\d+[\d.,/-]*$/g, "").trim();
      if (cleaned.length === 0) return 0;
      where.description = { equals: cleaned, mode: "insensitive" };
    } else {
      return 0;
    }
    const res = await prisma.transaction.updateMany({ where, data });
    return res.count;
  }

  createCategoryRule(data: {
    userId: string;
    merchantNamePattern: string | null;
    mcc: string | null;
    categoryId: string;
    priority: number;
  }): Promise<CategoryRule> {
    return prisma.categoryRule.create({ data });
  }

  findCategoryRulesByUser(userId: string): Promise<CategoryRule[]> {
    return prisma.categoryRule.findMany({ where: { userId }, orderBy: { priority: "desc" } });
  }

  createTransaction(data: Prisma.TransactionUncheckedCreateInput): Promise<Transaction> {
    return prisma.transaction.create({ data });
  }

  findAllTransactionsByUser(userId: string): Promise<Transaction[]> {
    return prisma.transaction.findMany({
      where: { bankAccount: { connectedAccount: { userId } } },
    });
  }

  async sumByPeriod(q: {
    userId: string;
    startDate?: Date;
    endDate?: Date;
    accountId?: string;
    accountIds?: string[];
    accountType?: 'BANK' | 'CREDIT';
  }): Promise<{ income: number; expense: number; count: number }> {
    const where: Prisma.TransactionWhereInput = {
      bankAccount: q.accountType
        ? { type: q.accountType, connectedAccount: { userId: q.userId, isInvestment: false } }
        : { connectedAccount: { userId: q.userId, isInvestment: false } },
      // Sempre exclui pagamento de fatura (transferência interna)
      categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
    };
    if (q.accountId) where.bankAccountId = q.accountId;
    else if (q.accountIds && q.accountIds.length > 0) where.bankAccountId = { in: q.accountIds };
    if (q.startDate || q.endDate) {
      where.occurredAt = {
        ...(q.startDate ? { gte: q.startDate } : {}),
        ...(q.endDate ? { lte: q.endDate } : {}),
      };
    }
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, amount: { gt: 0 } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.transaction.aggregate({
        where: { ...where, amount: { lt: 0 } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    return {
      income: incomeAgg._sum.amount ?? 0,
      expense: Math.abs(expenseAgg._sum.amount ?? 0),
      count: (incomeAgg._count._all ?? 0) + (expenseAgg._count._all ?? 0),
    };
  }

  async findSimilarTransactions(
    userId: string,
    excludeId: string,
    merchantName: string | null,
    description: string | null,
    limit = 10
  ): Promise<Transaction[]> {
    const orFilters: Prisma.TransactionWhereInput[] = [];
    if (merchantName) {
      orFilters.push({ merchantName: { equals: merchantName, mode: "insensitive" } });
    }
    if (description) {
      const cleaned = description.replace(/\s+\d+[\d.,/-]*$/g, "").trim();
      if (cleaned.length > 0) {
        orFilters.push({ description: { equals: cleaned, mode: "insensitive" } });
      }
    }
    if (orFilters.length === 0) return [];
    return prisma.transaction.findMany({
      where: {
        bankAccount: { connectedAccount: { userId } },
        id: { not: excludeId },
        OR: orFilters,
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: { category: true, bankAccount: { include: { connectedAccount: true } } },
    });
  }
}
