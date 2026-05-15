import { FastifyInstance } from "fastify";
import { DashboardController } from "./dashboard.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  const controller = new DashboardController();
  app.addHook("preHandler", authenticate);

  app.get("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          month: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
        },
        additionalProperties: false,
      },
    },
    handler: controller.get,
  });
}
