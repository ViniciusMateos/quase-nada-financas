import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./lib/errors.js";
import { authRoutes } from "./features/auth/auth.routes.js";
import { accountsRoutes, pluggyRoutes } from "./features/accounts/accounts.routes.js"; // RC-03
import { pluggyWebhookRoutes } from "./features/accounts/pluggy-webhook.routes.js";
import { transactionsRoutes } from "./features/transactions/transactions.routes.js";
import { categoriesRoutes } from "./features/categories/categories.routes.js";
import { dashboardRoutes } from "./features/dashboard/dashboard.routes.js";
import { binanceRoutes } from "./features/binance/binance.routes.js";
import {
  subscriptionsRoutes,
  categoryStatsRoutes,
  installmentsRoutes,
  weeklySummaryRoutes,
} from "./features/analytics/analytics.routes.js";
import { investmentsRoutes } from "./features/investments/investments.routes.js";
import { portfolioRoutes } from "./features/portfolio/portfolio.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger,
    trustProxy: true,
    bodyLimit: 1_048_576, // 1 MB
    disableRequestLogging: false,
  });

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Health check
  app.get("/health", async () => ({ status: "ok", env: env.NODE_ENV }));

  // API v1
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(accountsRoutes, { prefix: "/accounts" });
      await api.register(pluggyWebhookRoutes, { prefix: "/pluggy/webhook" }); // público, sem auth
      await api.register(pluggyRoutes, { prefix: "/pluggy" }); // RC-03: registrado explicitamente
      await api.register(transactionsRoutes, { prefix: "/transactions" });
      await api.register(categoriesRoutes, { prefix: "/categories" });
      await api.register(dashboardRoutes, { prefix: "/dashboard" });
      await api.register(binanceRoutes, { prefix: "/binance" });
      await api.register(subscriptionsRoutes, { prefix: "/subscriptions" });
      await api.register(categoryStatsRoutes, { prefix: "/categories" });
      await api.register(installmentsRoutes, { prefix: "/installments" });
      await api.register(weeklySummaryRoutes, { prefix: "/analytics/weekly-summary" });
      await api.register(investmentsRoutes, { prefix: "/investments" });
      await api.register(portfolioRoutes, { prefix: "/portfolio" });
    },
    { prefix: "/api/v1" }
  );

  // Error handler global — formato padronizado
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      req.log.warn({ code: err.code, statusCode: err.statusCode }, err.message);
      return reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
        },
      });
    }

    // Validation errors do Fastify (JSON Schema)
    if (err.validation) {
      return reply.status(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: err.message,
          statusCode: 400,
        },
      });
    }

    req.log.error({ err }, "Unhandled error");
    return reply.status(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Algo deu quase certo. Tente novamente.",
        statusCode: 500,
      },
    });
  });

  app.setNotFoundHandler((_, reply) => {
    return reply.status(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Rota não encontrada.",
        statusCode: 404,
      },
    });
  });

  return app;
}
