import { prisma } from "../../config/database.js";
import { redis } from "../../lib/redis.js";
import { INTERNAL_TRANSFER_CATEGORY_ID } from "../categories/categories.seed.js";

const CACHE_TTL = 5 * 60;

export interface DashboardPayload {
  month: string;
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    total: number;
    percentage: number;
  }>;
  topMerchants: Array<{ name: string; total: number }>;
  recentTransactions: Array<{
    id: string;
    amount: number;
    description: string;
    categoryName: string | null;
    categoryIcon: string | null;
    categoryColor: string | null;
    occurredAt: string;
  }>;
  generatedAt: string;
}

export class DashboardService {
  async getDashboard(userId: string, month: string): Promise<DashboardPayload> {
    const cacheKey = `dashboard:${userId}:${month}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as DashboardPayload;

    const [year, mon] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 1));

    const totalBalanceRow = await prisma.bankAccount.aggregate({
      where: { connectedAccount: { userId, isInvestment: false } },
      _sum: { balance: true },
    });

    const monthTxs = await prisma.transaction.findMany({
      where: {
        bankAccount: { connectedAccount: { userId, isInvestment: false } },
        occurredAt: { gte: start, lt: end },
        categoryId: { not: INTERNAL_TRANSFER_CATEGORY_ID },
      },
      select: {
        amount: true,
        merchantName: true,
        categoryId: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    });

    let monthlyIncome = 0;
    let monthlyExpenses = 0;
    const byCategoryMap = new Map<string, { categoryId: string; categoryName: string; categoryIcon: string | null; categoryColor: string | null; total: number }>();
    const merchantMap = new Map<string, number>();

    for (const tx of monthTxs) {
      if (tx.amount >= 0) {
        monthlyIncome += tx.amount;
      } else {
        monthlyExpenses += Math.abs(tx.amount);
        if (tx.categoryId) {
          const key = tx.categoryId;
          const prev = byCategoryMap.get(key);
          const categoryName = tx.category?.name ?? "Sem categoria";
          const categoryIcon = tx.category?.icon ?? null;
          const categoryColor = tx.category?.color ?? null;
          byCategoryMap.set(key, {
            categoryId: key,
            categoryName,
            categoryIcon,
            categoryColor,
            total: (prev?.total ?? 0) + Math.abs(tx.amount),
          });
        }
        if (tx.merchantName) {
          merchantMap.set(tx.merchantName, (merchantMap.get(tx.merchantName) ?? 0) + Math.abs(tx.amount));
        }
      }
    }

    const sortedCategories = [...byCategoryMap.values()].sort((a, b) => b.total - a.total);
    const topCategories = sortedCategories.slice(0, 6).map((c) => ({
      ...c,
      percentage: monthlyExpenses > 0 ? round((c.total / monthlyExpenses) * 100) : 0,
    }));
    const topMerchants = [...merchantMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }));

    const recentTxRows = await prisma.transaction.findMany({
      where: { bankAccount: { connectedAccount: { userId, isInvestment: false } } },
      orderBy: { occurredAt: "desc" },
      take: 5,
      select: {
        id: true,
        amount: true,
        description: true,
        occurredAt: true,
        category: { select: { name: true, icon: true, color: true } },
      },
    });

    const recentTransactions = recentTxRows.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      description: tx.description,
      categoryName: tx.category?.name ?? null,
      categoryIcon: tx.category?.icon ?? null,
      categoryColor: tx.category?.color ?? null,
      occurredAt: tx.occurredAt.toISOString(),
    }));

    const payload: DashboardPayload = {
      month,
      totalBalance: totalBalanceRow._sum.balance ?? 0,
      monthlyIncome: round(monthlyIncome),
      monthlyExpenses: round(monthlyExpenses),
      topCategories: topCategories.map((c) => ({ ...c, total: round(c.total) })),
      topMerchants: topMerchants.map((m) => ({ ...m, total: round(m.total) })),
      recentTransactions,
      generatedAt: new Date().toISOString(),
    };

    await redis.set(cacheKey, JSON.stringify(payload), "EX", CACHE_TTL);
    return payload;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
