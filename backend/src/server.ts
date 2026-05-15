import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./config/database.js";
import { redis } from "./lib/redis.js";

async function bootstrap(): Promise<void> {
  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutdown signal received");
    try {
      await app.close();
      await prisma.$disconnect();
      await redis.quit();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    logger.info({ port: env.PORT, host: env.HOST }, "Server started");
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
}

void bootstrap();
