import { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { rateLimit } from "../../middleware/rateLimit.js";
import { env } from "../../config/env.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const controller = new AuthController();

  app.post("/register", {
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 255 },
          password: { type: "string", minLength: 8, maxLength: 128 },
          name: { type: "string", maxLength: 120 },
        },
        additionalProperties: false,
      },
    },
    handler: controller.register,
  });

  app.post("/login", {
    preHandler: rateLimit({
      keyPrefix: "rl:login",
      max: env.LOGIN_RATE_LIMIT_MAX,
      windowSeconds: env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60,
      keyExtractor: (req) => req.ip,
    }),
    schema: {
      body: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 1, maxLength: 128 },
          deviceInfo: { type: "string", maxLength: 255 },
        },
        additionalProperties: false,
      },
    },
    handler: controller.login,
  });

  app.post("/refresh", {
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string", minLength: 10 } },
        additionalProperties: false,
      },
    },
    handler: controller.refresh,
  });

  app.delete("/logout", {
    preHandler: authenticate,
    schema: {
      body: {
        type: "object",
        required: ["refreshToken"],
        properties: { refreshToken: { type: "string", minLength: 10 } },
        additionalProperties: false,
      },
    },
    handler: controller.logout,
  });

  app.get("/me", { preHandler: authenticate, handler: controller.me });

  app.post("/biometric-challenge", {
    preHandler: authenticate,
    handler: controller.biometricChallenge,
  });

  app.post("/push-token", {
    preHandler: authenticate,
    schema: {
      body: {
        type: "object",
        required: ["pushToken"],
        properties: { pushToken: { type: ["string", "null"], maxLength: 256 } },
        additionalProperties: false,
      },
    },
    handler: controller.savePushToken,
  });

  app.patch("/password", {
    preHandler: authenticate,
    schema: {
      body: {
        type: "object",
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: { type: "string", minLength: 1, maxLength: 128 },
          newPassword: { type: "string", minLength: 8, maxLength: 128 },
        },
        additionalProperties: false,
      },
    },
    handler: controller.changePassword,
  });

  app.delete("/account", {
    preHandler: authenticate,
    schema: {
      body: {
        type: "object",
        required: ["password"],
        properties: { password: { type: "string", minLength: 1, maxLength: 128 } },
        additionalProperties: false,
      },
    },
    handler: controller.deleteAccount,
  });
}
