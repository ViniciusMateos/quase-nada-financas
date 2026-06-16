import { FastifyInstance } from "fastify";
import { AccountsController } from "./accounts.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AccountsController();
  app.addHook("preHandler", authenticate);

  app.get("/", {
    schema: {
      querystring: {
        type: "object",
        properties: { forceSync: { type: "boolean", default: false } },
        additionalProperties: false,
      },
    },
    handler: controller.list,
  });

  app.delete("/:connectedAccountId", {
    schema: {
      params: {
        type: "object",
        required: ["connectedAccountId"],
        properties: { connectedAccountId: { type: "string", format: "uuid" } },
      },
    },
    handler: controller.remove,
  });

  app.post("/:connectedAccountId/sync", {
    schema: {
      params: {
        type: "object",
        required: ["connectedAccountId"],
        properties: { connectedAccountId: { type: "string", format: "uuid" } },
      },
    },
    handler: controller.sync,
  });

  app.patch("/:connectedAccountId", {
    schema: {
      params: {
        type: "object",
        required: ["connectedAccountId"],
        properties: { connectedAccountId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        properties: { customName: { type: ["string", "null"], maxLength: 80 } },
        additionalProperties: false,
      },
    },
    handler: controller.rename,
  });

  app.patch("/bank-account/:bankAccountId/credit-close-day", {
    schema: {
      params: {
        type: "object",
        required: ["bankAccountId"],
        properties: { bankAccountId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["creditCloseDay"],
        properties: { creditCloseDay: { type: ["integer", "null"], minimum: 1, maximum: 31 } },
        additionalProperties: false,
      },
    },
    handler: controller.setCreditCloseDay,
  });

  app.patch("/bank-account/:bankAccountId/credit-due-day", {
    schema: {
      params: {
        type: "object",
        required: ["bankAccountId"],
        properties: { bankAccountId: { type: "string", format: "uuid" } },
      },
      body: {
        type: "object",
        required: ["creditDueDay"],
        properties: { creditDueDay: { type: ["integer", "null"], minimum: 1, maximum: 31 } },
        additionalProperties: false,
      },
    },
    handler: controller.setCreditDueDay,
  });

  // Pluggy sub-routes
  app.post("/../pluggy/connect-token", { handler: controller.pluggyConnectToken });

  // As rotas Pluggy também ficam registradas em /api/v1/pluggy via prefixo dedicado
}

/**
 * Rotas Pluggy expostas em /api/v1/pluggy.
 * Registradas separadamente em app.ts via accountsRoutes.pluggy.
 */
export async function pluggyRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AccountsController();
  app.addHook("preHandler", authenticate);

  app.post("/connect-token", {
    schema: {
      body: {
        type: "object",
        properties: { oauthRedirectUri: { type: "string", maxLength: 512 } },
        additionalProperties: false,
      },
    },
    handler: controller.pluggyConnectToken,
  });

  app.post("/callback", {
    schema: {
      body: {
        type: "object",
        required: ["itemId"],
        properties: { itemId: { type: "string", minLength: 1 } },
        additionalProperties: false,
      },
    },
    handler: controller.pluggyCallback,
  });
}
