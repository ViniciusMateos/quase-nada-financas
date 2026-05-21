import { FastifyInstance } from "fastify";
import { AnalyticsController } from "./analytics.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function subscriptionsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AnalyticsController();
  app.addHook("preHandler", authenticate);
  app.get("/", { handler: controller.subscriptions });
}

export async function categoryStatsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AnalyticsController();
  app.addHook("preHandler", authenticate);
  app.get("/stats", {
    schema: {
      querystring: {
        type: "object",
        properties: { month: { type: "string", pattern: "^\\d{4}-\\d{2}$" } },
        additionalProperties: false,
      },
    },
    handler: controller.categoryStats,
  });
}

export async function installmentsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AnalyticsController();
  app.addHook("preHandler", authenticate);
  app.get("/", { handler: controller.installments });
}

export async function weeklySummaryRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AnalyticsController();
  app.addHook("preHandler", authenticate);
  app.get("/", { handler: controller.weeklySummary });
}
