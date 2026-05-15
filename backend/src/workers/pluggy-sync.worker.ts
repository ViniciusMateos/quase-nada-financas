import { Worker, Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../config/database.js";
import { AccountsService } from "../features/accounts/accounts.service.js";
import { pluggySyncQueue, PLUGGY_SYNC_QUEUE } from "../lib/queue.js";
import { env } from "../config/env.js";

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

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, "Worker shutdown");
  clearInterval(handle);
  await worker.close();
  await pluggySyncQueue.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
