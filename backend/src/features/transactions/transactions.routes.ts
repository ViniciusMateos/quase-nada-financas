import { FastifyInstance } from "fastify";
import { TransactionsController } from "./transactions.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function transactionsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new TransactionsController();
  app.addHook("preHandler", authenticate);

  app.get("/", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
          accountId: { type: "string", format: "uuid" },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          categoryId: { type: "string", format: "uuid" },
        },
        additionalProperties: false,
      },
    },
    handler: controller.list,
  });

  app.patch("/:transactionId/category", {
    schema: {
      params: {
        type: "object",
        required: ["transactionId"],
        properties: { transactionId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["categoryId"],
        properties: {
          categoryId: { type: "string", format: "uuid" },
          createRule: { type: "boolean", default: false },
        },
        additionalProperties: false,
      },
    },
    handler: controller.updateCategory,
  });
}
