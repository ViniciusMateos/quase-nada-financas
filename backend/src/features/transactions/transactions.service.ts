import { TransactionsRepository } from "./transactions.repository.js";
import { Errors } from "../../lib/errors.js";
import { MCC_TO_CATEGORY_NAME } from "./mcc-map.js";
import { DEFAULT_CATEGORIES } from "../categories/categories.seed.js";
import type { PluggyTransaction } from "../../integrations/pluggy.client.js";

export interface ListFilters {
  cursor?: string;
  limit: number;
  accountId?: string;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
}

interface CursorPayload {
  id: string;
  occurredAt: string;
}

export class TransactionsService {
  private readonly repo = new TransactionsRepository();

  async listTransactions(userId: string, filters: ListFilters) {
    const cursor = decodeCursor(filters.cursor);
    const items = await this.repo.findTransactionsPage({
      userId,
      limit: filters.limit + 1,
      accountId: filters.accountId,
      startDate: filters.startDate,
      endDate: filters.endDate,
      categoryId: filters.categoryId,
      cursor,
    });

    let nextCursor: string | null = null;
    if (items.length > filters.limit) {
      const last = items.pop()!;
      nextCursor = encodeCursor({ id: last.id, occurredAt: last.occurredAt.toISOString() });
    }

    return { items, nextCursor };
  }

  async updateCategory(
    userId: string,
    transactionId: string,
    categoryId: string,
    createRule: boolean
  ) {
    const tx = await this.repo.findTransactionByIdForUser(userId, transactionId);
    if (!tx) throw Errors.NotFound("Transação não encontrada");

    const category = await this.repo.findCategoryForUser(userId, categoryId);
    if (!category) throw Errors.NotFound("Categoria não encontrada");

    const updated = await this.repo.updateTransactionCategory(transactionId, categoryId);

    if (createRule && tx.merchantName) {
      await this.repo.createCategoryRule({
        userId,
        merchantNamePattern: tx.merchantName.toLowerCase(),
        mcc: tx.merchantMcc ?? null,
        categoryId,
        priority: 10,
      });
    }

    return updated;
  }

  /**
   * Insere transações vindas do Pluggy aplicando categorização automática
   * pela ordem: 1) regras do usuário, 2) MCC → categoria padrão.
   */
  async ingestTransactions(
    userId: string,
    bankAccountId: string,
    pluggyTxs: PluggyTransaction[]
  ): Promise<number> {
    if (pluggyTxs.length === 0) return 0;

    const userRules = await this.repo.findCategoryRulesByUser(userId);

    let inserted = 0;
    for (const ptx of pluggyTxs) {
      const exists = await this.repo.findTransactionByExternalId(bankAccountId, ptx.id);
      if (exists) continue;

      const categoryId = await this.resolveCategoryId(userId, ptx, userRules);

      await this.repo.createTransaction({
        bankAccountId,
        externalId: ptx.id,
        amount: ptx.amount,
        currency: ptx.currencyCode ?? "BRL",
        description: ptx.description ?? "",
        merchantName: ptx.merchant?.name ?? null,
        merchantMcc: ptx.merchant?.mcc ?? null,
        paymentMethod: ptx.paymentData?.paymentMethod ?? null,
        occurredAt: new Date(ptx.date),
        installmentCurrent: ptx.creditCardMetadata?.installmentNumber ?? null,
        installmentTotal: ptx.creditCardMetadata?.totalInstallments ?? null,
        categoryId,
        rawData: ptx as unknown as Record<string, unknown>,
      });
      inserted++;
    }

    return inserted;
  }

  private async resolveCategoryId(
    userId: string,
    ptx: PluggyTransaction,
    userRules: Array<{
      merchantNamePattern: string | null;
      mcc: string | null;
      categoryId: string;
      priority: number;
    }>
  ): Promise<string | null> {
    const merchantName = ptx.merchant?.name?.toLowerCase() ?? "";
    const mcc = ptx.merchant?.mcc ?? null;

    // 1) regras do usuário (prioridade desc)
    const sortedRules = [...userRules].sort((a, b) => b.priority - a.priority);
    for (const rule of sortedRules) {
      if (rule.merchantNamePattern && merchantName.includes(rule.merchantNamePattern)) {
        return rule.categoryId;
      }
      if (rule.mcc && mcc && rule.mcc === mcc) {
        return rule.categoryId;
      }
    }

    // 2) MCC → categoria padrão
    if (mcc) {
      const categoryName = MCC_TO_CATEGORY_NAME[mcc];
      if (categoryName) {
        const cat = DEFAULT_CATEGORIES.find((c) => c.name === categoryName);
        if (cat) return cat.id;
      }
    }

    // 3) fallback: categoria "Outros"
    const fallback = DEFAULT_CATEGORIES.find((c) => c.name === "Outros");
    return fallback?.id ?? null;
  }
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): CursorPayload | undefined {
  if (!cursor) return undefined;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as CursorPayload;
    if (!parsed.id || !parsed.occurredAt) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}
