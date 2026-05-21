import type { InvestmentPendingAction, InvestmentRule, Prisma } from "@prisma/client";
import { prisma } from "../../config/database.js";

export class InvestmentsRepository {
  // -------- InvestmentRule --------

  createRule(data: Prisma.InvestmentRuleUncheckedCreateInput): Promise<InvestmentRule> {
    return prisma.investmentRule.create({ data });
  }

  findRuleById(id: string): Promise<InvestmentRule | null> {
    return prisma.investmentRule.findUnique({ where: { id } });
  }

  listRulesByUser(userId: string): Promise<InvestmentRule[]> {
    return prisma.investmentRule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  listActiveRulesByTrigger(triggerType: string): Promise<InvestmentRule[]> {
    return prisma.investmentRule.findMany({
      where: { triggerType, active: true },
    });
  }

  listActiveRulesForUserByTrigger(userId: string, triggerType: string): Promise<InvestmentRule[]> {
    return prisma.investmentRule.findMany({
      where: { userId, triggerType, active: true },
    });
  }

  updateRule(id: string, data: Prisma.InvestmentRuleUpdateInput): Promise<InvestmentRule> {
    return prisma.investmentRule.update({ where: { id }, data });
  }

  async deleteRule(id: string): Promise<void> {
    await prisma.investmentRule.delete({ where: { id } });
  }

  // -------- InvestmentPendingAction --------

  createPendingAction(data: Prisma.InvestmentPendingActionUncheckedCreateInput): Promise<InvestmentPendingAction> {
    return prisma.investmentPendingAction.create({ data });
  }

  findPendingActionById(id: string): Promise<InvestmentPendingAction | null> {
    return prisma.investmentPendingAction.findUnique({ where: { id } });
  }

  listPendingActionsByUser(userId: string, statuses?: string[]): Promise<InvestmentPendingAction[]> {
    return prisma.investmentPendingAction.findMany({
      where: {
        userId,
        ...(statuses && statuses.length > 0 ? { status: { in: statuses } } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }

  updatePendingAction(id: string, data: Prisma.InvestmentPendingActionUpdateInput): Promise<InvestmentPendingAction> {
    return prisma.investmentPendingAction.update({ where: { id }, data });
  }

  /** Expira PendingActions PENDING cujo dueAt já passou. */
  async expireOldPendingActions(): Promise<number> {
    const res = await prisma.investmentPendingAction.updateMany({
      where: { status: "PENDING", dueAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    return res.count;
  }

  countPendingThisMonthForRule(ruleId: string, monthStart: Date): Promise<number> {
    return prisma.investmentPendingAction.count({
      where: { ruleId, createdAt: { gte: monthStart } },
    });
  }
}
