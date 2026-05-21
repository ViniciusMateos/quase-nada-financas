import { FastifyInstance } from "fastify";
import { InvestmentsController } from "./investments.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const ruleBody = {
  type: "object",
  required: ["name", "triggerType", "actionType", "asset", "amountBrl"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    active: { type: "boolean" },
    triggerType: { type: "string", enum: ["monthly", "weekly", "salary_received"] },
    triggerDay: { type: ["integer", "null"], minimum: 0, maximum: 31 },
    triggerMinAmount: { type: ["number", "null"], exclusiveMinimum: 0 },
    actionType: { type: "string", enum: ["buy_binance", "reminder"] },
    asset: { type: "string", minLength: 1, maxLength: 32 },
    amountBrl: { type: "number", exclusiveMinimum: 0, maximum: 1_000_000 },
    maxAmountBrl: { type: ["number", "null"], exclusiveMinimum: 0, maximum: 1_000_000 },
    maxFiresPerMonth: { type: "integer", minimum: 1, maximum: 30 },
  },
  additionalProperties: false,
} as const;

const ruleUpdateBody = {
  type: "object",
  properties: ruleBody.properties,
  additionalProperties: false,
} as const;

export async function investmentsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new InvestmentsController();
  app.addHook("preHandler", authenticate);

  // ---- Rules ----
  app.get("/rules", { handler: controller.listRules });

  app.post("/rules", { schema: { body: ruleBody }, handler: controller.createRule });

  app.patch("/rules/:ruleId", {
    schema: {
      params: {
        type: "object",
        required: ["ruleId"],
        properties: { ruleId: { type: "string", format: "uuid" } },
      },
      body: ruleUpdateBody,
    },
    handler: controller.updateRule,
  });

  app.delete("/rules/:ruleId", {
    schema: {
      params: {
        type: "object",
        required: ["ruleId"],
        properties: { ruleId: { type: "string", format: "uuid" } },
      },
    },
    handler: controller.deleteRule,
  });

  // ---- Pending actions ----
  app.get("/pending", {
    schema: {
      querystring: {
        type: "object",
        properties: { includeFinalized: { type: "boolean", default: false } },
        additionalProperties: false,
      },
    },
    handler: controller.listPending,
  });

  app.post("/pending/:pendingId/approve", {
    schema: {
      params: {
        type: "object",
        required: ["pendingId"],
        properties: { pendingId: { type: "string", format: "uuid" } },
      },
    },
    handler: controller.approvePending,
  });

  app.post("/pending/:pendingId/dismiss", {
    schema: {
      params: {
        type: "object",
        required: ["pendingId"],
        properties: { pendingId: { type: "string", format: "uuid" } },
      },
    },
    handler: controller.dismissPending,
  });
}
