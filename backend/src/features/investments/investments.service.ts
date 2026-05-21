import type { InvestmentRule } from "@prisma/client";
import { logger } from "../../lib/logger.js";
import { Errors } from "../../lib/errors.js";
import { sendPushToUser } from "../../lib/push.js";
import { InvestmentsRepository } from "./investments.repository.js";
import { BinanceService } from "../binance/binance.service.js";

function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

const PENDING_TTL_HOURS = 24;
const TRIGGER_TYPES = new Set(["monthly", "weekly", "salary_received"]);
const ACTION_TYPES = new Set(["buy_binance", "reminder"]);

export interface CreateRuleInput {
  name: string;
  active?: boolean;
  triggerType: string;
  triggerDay?: number | null;
  triggerMinAmount?: number | null;
  actionType: string;
  asset: string;
  amountBrl: number;
  maxAmountBrl?: number | null;
  maxFiresPerMonth?: number;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;

export class InvestmentsService {
  private readonly repo = new InvestmentsRepository();
  private readonly binance = new BinanceService();

  // -------------- Rules CRUD --------------

  async createRule(userId: string, input: CreateRuleInput) {
    this.validateRuleInput(input);
    return this.repo.createRule({
      userId,
      name: input.name,
      active: input.active ?? true,
      triggerType: input.triggerType,
      triggerDay: input.triggerDay ?? null,
      triggerMinAmount: input.triggerMinAmount ?? null,
      actionType: input.actionType,
      asset: input.asset.toUpperCase(),
      amountBrl: input.amountBrl,
      maxAmountBrl: input.maxAmountBrl ?? input.amountBrl * 1.5,
      maxFiresPerMonth: input.maxFiresPerMonth ?? 2,
    });
  }

  async updateRule(userId: string, id: string, input: UpdateRuleInput) {
    const rule = await this.repo.findRuleById(id);
    if (!rule || rule.userId !== userId) throw Errors.NotFound("Regra não encontrada");
    if (input.triggerType || input.actionType) {
      this.validateRuleInput({ ...rule, ...input } as CreateRuleInput);
    }
    return this.repo.updateRule(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.triggerType !== undefined ? { triggerType: input.triggerType } : {}),
      ...(input.triggerDay !== undefined ? { triggerDay: input.triggerDay } : {}),
      ...(input.triggerMinAmount !== undefined ? { triggerMinAmount: input.triggerMinAmount } : {}),
      ...(input.actionType !== undefined ? { actionType: input.actionType } : {}),
      ...(input.asset !== undefined ? { asset: input.asset.toUpperCase() } : {}),
      ...(input.amountBrl !== undefined ? { amountBrl: input.amountBrl } : {}),
      ...(input.maxAmountBrl !== undefined ? { maxAmountBrl: input.maxAmountBrl } : {}),
      ...(input.maxFiresPerMonth !== undefined ? { maxFiresPerMonth: input.maxFiresPerMonth } : {}),
    });
  }

  async deleteRule(userId: string, id: string) {
    const rule = await this.repo.findRuleById(id);
    if (!rule || rule.userId !== userId) throw Errors.NotFound("Regra não encontrada");
    await this.repo.deleteRule(id);
  }

  listRules(userId: string) {
    return this.repo.listRulesByUser(userId);
  }

  // -------------- Triggers (criam PendingAction) --------------

  /** Chamado pelo ingest de transações quando entra uma tx categorizada como Salário. */
  async onSalaryReceived(userId: string, txAmount: number) {
    const rules = await this.repo.listActiveRulesForUserByTrigger(userId, "salary_received");
    for (const rule of rules) {
      if (rule.triggerMinAmount && txAmount < rule.triggerMinAmount) continue;
      await this.fireRule(rule).catch((err) => {
        logger.error({ err, ruleId: rule.id }, "Falha ao disparar regra salary_received");
      });
    }
  }

  /** Worker cron: chamar 1x/hora. Dispara regras monthly/weekly cujo dia bate hoje. */
  async fireScheduledRules(now: Date = new Date()) {
    const todayMonthDay = now.getDate();
    const todayWeekday = now.getDay(); // 0-6

    const monthly = await this.repo.listActiveRulesByTrigger("monthly");
    const weekly = await this.repo.listActiveRulesByTrigger("weekly");

    let fired = 0;
    for (const rule of monthly) {
      if (rule.triggerDay !== todayMonthDay) continue;
      if (this.alreadyFiredToday(rule, now)) continue;
      try {
        await this.fireRule(rule, now);
        fired++;
      } catch (err) {
        logger.error({ err, ruleId: rule.id }, "Falha disparar monthly");
      }
    }
    for (const rule of weekly) {
      if (rule.triggerDay !== todayWeekday) continue;
      if (this.alreadyFiredToday(rule, now)) continue;
      try {
        await this.fireRule(rule, now);
        fired++;
      } catch (err) {
        logger.error({ err, ruleId: rule.id }, "Falha disparar weekly");
      }
    }
    return fired;
  }

  // -------------- Pending Actions (aprovar/dispensar) --------------

  listPending(userId: string, includeFinalized = false) {
    const statuses = includeFinalized
      ? undefined
      : ["PENDING", "APPROVED"];
    return this.repo.listPendingActionsByUser(userId, statuses);
  }

  async approve(userId: string, pendingId: string) {
    const pending = await this.repo.findPendingActionById(pendingId);
    if (!pending || pending.userId !== userId) throw Errors.NotFound("Pendência não encontrada");
    if (pending.status !== "PENDING") throw Errors.Validation(`Pendência em status ${pending.status}`);
    if (pending.dueAt < new Date()) {
      await this.repo.updatePendingAction(pendingId, { status: "EXPIRED" });
      throw Errors.Validation("Pendência expirou");
    }

    await this.repo.updatePendingAction(pendingId, {
      status: "APPROVED",
      approvedAt: new Date(),
    });

    if (pending.actionType === "buy_binance") {
      try {
        const order = await this.binance.placeOrderAutomated(userId, pending.asset, pending.amountBrl);
        return await this.repo.updatePendingAction(pendingId, {
          status: "EXECUTED",
          executedAt: new Date(),
          executedOrderId: order.id,
          resultMessage: `Ordem ${order.id} executada (${order.amountAsset ?? 0} ${pending.asset})`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        return await this.repo.updatePendingAction(pendingId, {
          status: "FAILED",
          resultMessage: message,
        });
      }
    }

    // reminder: aprovar = "já fiz manualmente" → marca como EXECUTED
    return this.repo.updatePendingAction(pendingId, {
      status: "EXECUTED",
      executedAt: new Date(),
      resultMessage: "Marcado como feito",
    });
  }

  async dismiss(userId: string, pendingId: string) {
    const pending = await this.repo.findPendingActionById(pendingId);
    if (!pending || pending.userId !== userId) throw Errors.NotFound("Pendência não encontrada");
    if (pending.status !== "PENDING") throw Errors.Validation(`Pendência em status ${pending.status}`);

    return this.repo.updatePendingAction(pendingId, {
      status: "DISMISSED",
    });
  }

  // -------------- Manutenção --------------

  expireOldPending() {
    return this.repo.expireOldPendingActions();
  }

  // -------------- Internas --------------

  private alreadyFiredToday(rule: InvestmentRule, now: Date): boolean {
    if (!rule.lastFiredAt) return false;
    const last = rule.lastFiredAt;
    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate()
    );
  }

  /**
   * Dispara uma regra: valida limites e cria a PendingAction.
   * Não executa a action — espera aprovação do usuário.
   */
  private async fireRule(rule: InvestmentRule, now: Date = new Date()) {
    // Validação: hard cap
    if (rule.maxAmountBrl && rule.amountBrl > rule.maxAmountBrl) {
      await this.repo.updateRule(rule.id, {
        lastError: `amountBrl ${rule.amountBrl} excede maxAmountBrl ${rule.maxAmountBrl}`,
      });
      return;
    }

    // Reset contador se mudou de mês
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let firesThisMonth = rule.firesThisMonth;
    if (!rule.firesMonthRef || rule.firesMonthRef < monthStart) {
      firesThisMonth = 0;
    }

    if (firesThisMonth >= rule.maxFiresPerMonth) {
      await this.repo.updateRule(rule.id, {
        lastError: `maxFiresPerMonth (${rule.maxFiresPerMonth}) atingido`,
      });
      return;
    }

    // Cria PendingAction
    const dueAt = new Date(now.getTime() + PENDING_TTL_HOURS * 3_600_000);
    await this.repo.createPendingAction({
      userId: rule.userId,
      ruleId: rule.id,
      actionType: rule.actionType,
      asset: rule.asset,
      amountBrl: rule.amountBrl,
      status: "PENDING",
      dueAt,
    });

    const isBuy = rule.actionType === "buy_binance";
    void sendPushToUser(
      rule.userId,
      isBuy ? "Aprovar compra? 🟡" : "Hora de investir 🟡",
      isBuy
        ? `Regra "${rule.name}": confirmar compra de ${formatBrl(rule.amountBrl)} em ${rule.asset}.`
        : `Regra "${rule.name}": investir ${formatBrl(rule.amountBrl)} em ${rule.asset}.`,
      { type: "pending_action", ruleId: rule.id }
    );

    // Atualiza contadores da regra
    await this.repo.updateRule(rule.id, {
      lastFiredAt: now,
      firesThisMonth: firesThisMonth + 1,
      firesMonthRef: monthStart,
      lastError: null,
    });
  }

  private validateRuleInput(input: CreateRuleInput): void {
    if (!TRIGGER_TYPES.has(input.triggerType)) {
      throw Errors.Validation(`triggerType inválido: ${input.triggerType}`);
    }
    if (!ACTION_TYPES.has(input.actionType)) {
      throw Errors.Validation(`actionType inválido: ${input.actionType}`);
    }
    if (input.amountBrl <= 0) {
      throw Errors.Validation("amountBrl deve ser positivo");
    }
    if (input.triggerType === "monthly" && (input.triggerDay == null || input.triggerDay < 1 || input.triggerDay > 31)) {
      throw Errors.Validation("monthly: triggerDay deve ser 1-31");
    }
    if (input.triggerType === "weekly" && (input.triggerDay == null || input.triggerDay < 0 || input.triggerDay > 6)) {
      throw Errors.Validation("weekly: triggerDay deve ser 0-6 (dom-sab)");
    }
    if (input.triggerType === "salary_received" && (!input.triggerMinAmount || input.triggerMinAmount <= 0)) {
      throw Errors.Validation("salary_received: triggerMinAmount obrigatório e > 0");
    }
  }
}
