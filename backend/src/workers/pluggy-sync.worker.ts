import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../config/database.js";
import { AccountsService } from "../features/accounts/accounts.service.js";
import { InvestmentsService } from "../features/investments/investments.service.js";
import { AnalyticsService } from "../features/analytics/analytics.service.js";
import { sendPushToUser } from "../lib/push.js";
import { pluggySyncQueue, PLUGGY_SYNC_QUEUE } from "../lib/queue.js";
import { env } from "../config/env.js";

function formatBrlValue(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

interface SyncJobData {
  userId: string;
  connectedAccountId: string;
}

const accountsService = new AccountsService();

const worker = new Worker<SyncJobData>(
  PLUGGY_SYNC_QUEUE,
  async (job: Job<SyncJobData>) => {
    const { userId, connectedAccountId } = job.data;
    logger.info({ userId, connectedAccountId, jobId: job.id }, "Pluggy sync job started");
    try {
      const result = await accountsService.syncAccount(userId, connectedAccountId);
      logger.info({ userId, connectedAccountId, ...result }, "Pluggy sync job done");
      return result;
    } catch (err) {
      logger.error({ err, userId, connectedAccountId }, "Pluggy sync job failed");
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: 4,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  }
);

worker.on("ready", () => logger.info("Pluggy sync worker ready"));
worker.on("error", (err) => logger.error({ err }, "Pluggy sync worker error"));

/**
 * Agenda jobs recorrentes para todas as contas ativas.
 * Roda no boot do worker e depois a cada `PLUGGY_SYNC_INTERVAL_HOURS`.
 */
async function enqueueAllActiveAccounts(): Promise<void> {
  const accounts = await prisma.connectedAccount.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, userId: true },
  });
  for (const acc of accounts) {
    await pluggySyncQueue.add(
      `sync-${acc.id}`,
      { userId: acc.userId, connectedAccountId: acc.id },
      {
        jobId: `sync-${acc.id}-${Date.now()}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 30_000 },
      }
    );
  }
  logger.info({ count: accounts.length }, "Enqueued Pluggy sync jobs");
}

const intervalMs = env.PLUGGY_SYNC_INTERVAL_HOURS * 60 * 60 * 1000;

void enqueueAllActiveAccounts();
const handle = setInterval(() => void enqueueAllActiveAccounts(), intervalMs);

// ---- Investment rules scheduler ----
const investmentsService = new InvestmentsService();

async function runScheduledFires(): Promise<void> {
  try {
    const fired = await investmentsService.fireScheduledRules();
    if (fired > 0) logger.info({ fired }, "Investment scheduled rules fired");
  } catch (err) {
    logger.error({ err }, "Investment scheduler error");
  }
}

async function runExpirePending(): Promise<void> {
  try {
    const expired = await investmentsService.expireOldPending();
    if (expired > 0) logger.info({ expired }, "Investment pending actions expired");
  } catch (err) {
    logger.error({ err }, "Investment expire error");
  }
}

async function runAutoCompleteAportes(): Promise<void> {
  try {
    const completed = await investmentsService.autoCompleteAportes();
    if (completed > 0) logger.info({ completed }, "Aportes detectados e pendências fechadas");
  } catch (err) {
    logger.error({ err }, "Auto-complete aportes error");
  }
}

// ---- Resumo semanal: segunda-feira 10h (horário de Brasília, UTC-3) ----
const analyticsService = new AnalyticsService();

async function runWeeklySummary(): Promise<void> {
  try {
    // Hora de Brasília = UTC - 3
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 3_600_000);
    const isMonday = brt.getUTCDay() === 1;
    const hour = brt.getUTCHours();
    if (!isMonday || hour !== 10) return;

    // Evita reenviar na mesma semana (flag no Redis com TTL de 2 dias)
    const weekKey = `weekly-summary:${brt.getUTCFullYear()}-${getWeekNumber(brt)}`;
    const already = await redis.get(weekKey);
    if (already) return;
    await redis.set(weekKey, "1", "EX", 2 * 86_400);

    const users = await prisma.user.findMany({
      where: { pushToken: { not: null } },
      select: { id: true },
    });
    for (const u of users) {
      try {
        const summary = await analyticsService.getWeeklySummary(u.id);
        if (summary.count === 0) continue;
        const sign = summary.net >= 0 ? "+" : "-";
        await sendPushToUser(
          u.id,
          "Resumo da semana 📊",
          `Entrou ${formatBrlValue(summary.income)}, saiu ${formatBrlValue(summary.expense)}. Saldo ${sign}${formatBrlValue(Math.abs(summary.net))}. Toque pra ver os detalhes.`,
          { type: "weekly_summary" }
        );
      } catch (err) {
        logger.error({ err, userId: u.id }, "Erro no resumo semanal do usuário");
      }
    }
    logger.info({ count: users.length }, "Resumo semanal enviado");
  } catch (err) {
    logger.error({ err }, "Weekly summary error");
  }
}

// ---- Lembretes de fatura de cartão: 1x/dia às 10h BRT ----

/** min(day, dias do mês de `ref`) — evita dia 31 em mês de 30. */
function clampDayToMonth(day: number, ref: Date): number {
  const days = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.min(day, days);
}

function formatDayMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Envia uma push só uma vez (dedup por chave no Redis, TTL 3 dias). */
async function sendPushOnce(
  key: string,
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const already = await redis.get(key);
  if (already) return;
  await redis.set(key, "1", "EX", 3 * 86_400);
  await sendPushToUser(userId, title, body, data);
}

/**
 * Lembretes de fatura por cartão: quando a fatura FECHA (com o total
 * aproximado), 1 dia antes do vencimento e no dia do vencimento. Roda 1x/dia
 * às 10h BRT; dedup por cartão+ciclo no Redis.
 */
async function runCreditCardReminders(): Promise<void> {
  try {
    const now = new Date();
    const brt = new Date(now.getTime() - 3 * 3_600_000);
    if (brt.getUTCHours() !== 10) return;

    const todayDay = brt.getUTCDate();
    const tomorrow = new Date(brt.getTime() + 86_400_000);
    const tomorrowDay = tomorrow.getUTCDate();
    const ym = `${brt.getUTCFullYear()}-${brt.getUTCMonth() + 1}`;

    const users = await prisma.user.findMany({
      where: { pushToken: { not: null } },
      select: { id: true },
    });

    for (const u of users) {
      try {
        const accounts = await accountsService.listAccounts(u.id, false);
        for (const acc of accounts) {
          const name = acc.customName || acc.bankName;
          for (const ba of acc.bankAccounts) {
            if (ba.type !== "CREDIT") continue;
            const amount = ba.statementClosedAmount ?? ba.currentStatementAmount ?? 0;
            const dueLabel = formatDayMonth(ba.statementDueDate);

            // Fatura fechou hoje → total aproximado.
            if (ba.creditCloseDay && todayDay === clampDayToMonth(ba.creditCloseDay, brt) && amount > 0) {
              await sendPushOnce(
                `cc-close:${ba.id}:${ym}`,
                u.id,
                "Fatura fechou 📄",
                `A fatura do ${name} fechou em aproximadamente ${formatBrlValue(amount)}${dueLabel ? `. Vence ${dueLabel}` : ""}.`,
                { type: "credit_card_closed", bankAccountId: ba.id }
              );
            }

            if (ba.creditDueDay && amount > 0) {
              // 1 dia antes (amanhã é o vencimento) — usa o mês de amanhã pra acertar virada de mês.
              if (tomorrowDay === clampDayToMonth(ba.creditDueDay, tomorrow)) {
                await sendPushOnce(
                  `cc-due1:${ba.id}:${ym}`,
                  u.id,
                  "Fatura vence amanhã ⏰",
                  `A fatura do ${name} (${formatBrlValue(amount)}) vence amanhã${dueLabel ? `, ${dueLabel}` : ""}. Não esquece!`,
                  { type: "credit_card_due_tomorrow", bankAccountId: ba.id }
                );
              }
              // No dia do vencimento.
              if (todayDay === clampDayToMonth(ba.creditDueDay, brt)) {
                await sendPushOnce(
                  `cc-due0:${ba.id}:${ym}`,
                  u.id,
                  "Fatura vence hoje 🔔",
                  `Hoje é o vencimento da fatura do ${name}: ${formatBrlValue(amount)}.`,
                  { type: "credit_card_due_today", bankAccountId: ba.id }
                );
              }
            }
          }
        }
      } catch (err) {
        logger.error({ err, userId: u.id }, "Erro nos lembretes de fatura do usuário");
      }
    }
  } catch (err) {
    logger.error({ err }, "Credit card reminders error");
  }
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

// Roda no boot e a cada hora
void runScheduledFires();
void runWeeklySummary();
void runCreditCardReminders();
const fireHandle = setInterval(() => {
  void runScheduledFires();
  void runWeeklySummary();
  void runCreditCardReminders();
}, 60 * 60 * 1000);

// Expira pending a cada 10 min
void runExpirePending();
const expireHandle = setInterval(() => void runExpirePending(), 10 * 60 * 1000);

// Detecta aportes reais e fecha pendências a cada 30 min (no-op se não houver pendência)
void runAutoCompleteAportes();
const aportesHandle = setInterval(() => void runAutoCompleteAportes(), 30 * 60 * 1000);

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Worker shutdown");
  clearInterval(handle);
  clearInterval(fireHandle);
  clearInterval(expireHandle);
  clearInterval(aportesHandle);
  await worker.close();
  await pluggySyncQueue.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
