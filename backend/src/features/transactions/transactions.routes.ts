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
          accountIds: { type: "string" },
          accountType: { type: "string", enum: ["BANK", "CREDIT"] },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
          categoryId: { type: "string", format: "uuid" },
        },
        additionalProperties: false,
      },
    },
    handler: controller.list,
  });

  app.get("/summary", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          accountId: { type: "string", format: "uuid" },
          accountIds: { type: "string" },
          accountType: { type: "string", enum: ["BANK", "CREDIT"] },
          startDate: { type: "string", format: "date" },
          endDate: { type: "string", format: "date" },
        },
        additionalProperties: false,
      },
    },
    handler: controller.summary,
  });

  app.post("/recategorize", { handler: controller.recategorize });

  app.get("/:transactionId/similar", {
    schema: {
      params: {
        type: "object",
        required: ["transactionId"],
        properties: { transactionId: { type: "string", format: "uuid" } },
      },
    },
    handler: controller.similar,
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

  app.patch("/:transactionId", {
    schema: {
      params: {
        type: "object",
        required: ["transactionId"],
        properties: { transactionId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: {
          alias: { type: ["string", "null"], maxLength: 200 },
          categoryId: { type: "string", format: "uuid" },
          isSubscriptionOverride: { type: ["boolean", "null"] },
        },
        additionalProperties: false,
      },
    },
    handler: controller.updateTransaction,
  });
}
