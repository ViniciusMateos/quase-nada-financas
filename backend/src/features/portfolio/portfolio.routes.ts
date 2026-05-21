import { FastifyInstance } from "fastify";
import { PortfolioController } from "./portfolio.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function portfolioRoutes(app: FastifyInstance): Promise<void> {
  const controller = new PortfolioController();
  app.addHook("preHandler", authenticate);

  app.get("/", { handler: controller.get });

  app.get("/investments/:id/transactions", {
    schema: {
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", minLength: 1 } },
      },
    },
    handler: controller.investmentTransactions,
  });
}
