import { prisma } from "../../config/database.js";
import type { Prisma, Transaction, CategoryRule } from "@prisma/client";

interface PageQuery {
  userId: string;
  limit: number;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  cursor?: { id: string; occurredAt: string };
}

export class TransactionsRepository {
  async findTransactionsPage(q: PageQuery) {
    const where: Prisma.TransactionWhereInput = {
      bankAccount: { connectedAccount: { userId: q.userId } },
    };
    if (q.accountId) where.bankAccountId = q.accountId;
    if (q.categoryId) where.categoryId = q.categoryId;
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
      include: { category: true },
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
}
