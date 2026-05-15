import { prisma } from "../../config/database.js";
import type { BinanceAccount, InvestmentOrder, Prisma } from "@prisma/client";

interface CreateAccount {
  userId: string;
  apiKeyEnc: string;
  apiSecretEnc: string;
}

interface CreateOrder {
  userId: string;
  binanceAccountId: string;
  asset: string;
  amountBrl: number;
  orderType: string;
  triggerType: string;
  status: string;
}

export class BinanceRepository {
  findByUser(userId: string): Promise<BinanceAccount | null> {
    return prisma.binanceAccount.findUnique({ where: { userId } });
  }

  create(data: CreateAccount): Promise<BinanceAccount> {
    return prisma.binanceAccount.create({ data });
  }

  upsertReplace(data: CreateAccount): Promise<BinanceAccount> {
    return prisma.binanceAccount.upsert({
      where: { userId: data.userId },
      update: { apiKeyEnc: data.apiKeyEnc, apiSecretEnc: data.apiSecretEnc },
      create: data,
    });
  }

  async deleteByUser(userId: string): Promise<void> {
    await prisma.binanceAccount.deleteMany({ where: { userId } });
  }

  createOrder(data: CreateOrder): Promise<InvestmentOrder> {
    return prisma.investmentOrder.create({ data });
  }

  updateOrder(
    id: string,
    data: Prisma.InvestmentOrderUncheckedUpdateInput
  ): Promise<InvestmentOrder> {
    return prisma.investmentOrder.update({ where: { id }, data });
  }

  async listOrders(userId: string, cursor: string | undefined, limit: number) {
    const decoded = cursor
      ? (JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
          id: string;
          createdAt: string;
        })
      : null;

    const where: Prisma.InvestmentOrderWhereInput = { userId };
    if (decoded) {
      const cursorDate = new Date(decoded.createdAt);
      where.OR = [
        { createdAt: { lt: cursorDate } },
        { createdAt: cursorDate, id: { lt: decoded.id } },
      ];
    }

    const items = await prisma.investmentOrder.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const last = items.pop()!;
      nextCursor = Buffer.from(
        JSON.stringify({ id: last.id, createdAt: last.createdAt.toISOString() }),
        "utf8"
      ).toString("base64url");
    }

    return { items, nextCursor };
  }
}
