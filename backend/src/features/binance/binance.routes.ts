import { FastifyInstance } from "fastify";
import { BinanceController } from "./binance.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { env } from "../../config/env.js";

export async function binanceRoutes(app: FastifyInstance): Promise<void> {
  const controller = new BinanceController();
  app.addHook("preHandler", authenticate);

  const credentialsBody = {
    type: "object",
    required: ["apiKey", "apiSecret"],
    properties: {
      apiKey: { type: "string", minLength: 10, maxLength: 256 },
      apiSecret: { type: "string", minLength: 10, maxLength: 256 },
    },
    additionalProperties: false,
  };

  app.post("/connect", { schema: { body: credentialsBody }, handler: controller.connect });
  app.put("/connect", { schema: { body: credentialsBody }, handler: controller.replace });
  app.delete("/connect", { handler: controller.disconnect });
  app.get("/wallet", { handler: controller.wallet });

  app.get("/quote/:symbol", {
    schema: {
      params: {
        type: "object",
        required: ["symbol"],
        properties: { symbol: { type: "string", pattern: "^[A-Z0-9]{2,10}$" } },
      },
    },
    handler: controller.quote,
  });

  app.post("/orders", {
    preHandler: rateLimit({
      keyPrefix: "rl:orders",
      max: env.ORDER_RATE_LIMIT_MAX,
      windowSeconds: env.ORDER_RATE_LIMIT_WINDOW_SECONDS,
      keyExtractor: (req) => req.userId,
    }),
    schema: {
      body: {
        type: "object",
        required: ["asset", "amountBrl", "biometricToken"],
        properties: {
          asset: { type: "string", pattern: "^[A-Z0-9]{2,10}$" },
          amountBrl: { type: "number", exclusiveMinimum: 0, maximum: 1_000_000 },
          biometricToken: { type: "string", format: "uuid" },
        },
        additionalProperties: false,
      },
    },
    handler: controller.placeOrder,
  });

  app.get("/orders", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
        },
        additionalProperties: false,
      },
    },
    handler: controller.listOrders,
  });
}
