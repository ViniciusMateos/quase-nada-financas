import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/database.js";
import { pluggySyncQueue } from "../../lib/queue.js";
import { logger } from "../../lib/logger.js";
import { PluggyClient } from "../../integrations/pluggy.client.js";
import { AccountsService } from "./accounts.service.js";

interface PluggyWebhookBody {
  event?: string;
  itemId?: string;
  id?: string;
  clientId?: string;
  triggeredBy?: string;
  [key: string]: unknown;
}

const SYNC_TRIGGER_EVENTS = new Set([
  "item/created",
  "item/updated",
  "transactions/created",
  "transactions/updated",
  "transactions/deleted",
]);

const CREATE_EVENTS = new Set(["item/created", "item/updated"]);

export async function pluggyWebhookRoutes(app: FastifyInstance): Promise<void> {
  const pluggy = new PluggyClient();
  const accountsService = new AccountsService();

  app.post(
    "/",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    async (req: FastifyRequest<{ Body: PluggyWebhookBody }>, reply: FastifyReply) => {
      const { event, itemId } = req.body;
      logger.info({ event, itemId, body: req.body }, "Pluggy webhook received");

      if (!event || !itemId) {
        return reply.status(200).send({ ok: true, ignored: "missing event or itemId" });
      }

      if (!SYNC_TRIGGER_EVENTS.has(event)) {
        return reply.status(200).send({ ok: true, ignored: event });
      }

      const connected = await prisma.connectedAccount.findUnique({
        where: { pluggyItemId: itemId },
        select: { id: true, userId: true, status: true },
      });

      // Item desconhecido + evento de criação → tenta auto-criar a ConnectedAccount
      // a partir do clientUserId que enviamos no createConnectToken
      if (!connected && CREATE_EVENTS.has(event)) {
        try {
          const item = await pluggy.getItem(itemId);
          const clientUserId = item.clientUserId;
          if (!clientUserId) {
            logger.warn({ itemId, event }, "Webhook auto-create: item has no clientUserId");
            return reply.status(200).send({ ok: true, ignored: "no clientUserId" });
          }

          const user = await prisma.user.findUnique({ where: { id: clientUserId }, select: { id: true } });
          if (!user) {
            logger.warn({ itemId, clientUserId, event }, "Webhook auto-create: user not found");
            return reply.status(200).send({ ok: true, ignored: "user not found" });
          }

          logger.info({ itemId, clientUserId, event }, "Webhook auto-create: creating ConnectedAccount from webhook");
          const result = await accountsService.handlePluggyCallback(clientUserId, itemId);
          return reply.status(200).send({ ok: true, autoCreated: result.connectedAccountId });
        } catch (err) {
          logger.error({ err, itemId, event }, "Webhook auto-create failed");
          // 200 mesmo em erro pra Pluggy não ficar tentando reentregar infinitamente.
          // Se foi falha transitória, o worker cron pega na próxima rodada.
          return reply.status(200).send({ ok: true, error: "auto-create failed" });
        }
      }

      if (!connected) {
        logger.warn({ itemId, event }, "Webhook for unknown pluggyItemId");
        return reply.status(200).send({ ok: true, ignored: "unknown itemId" });
      }

      if (connected.status !== "ACTIVE") {
        return reply.status(200).send({ ok: true, ignored: "inactive account" });
      }

      await pluggySyncQueue.add(
        `webhook-${connected.id}`,
        { userId: connected.userId, connectedAccountId: connected.id },
        {
          jobId: `webhook-${connected.id}-${Date.now()}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 15_000 },
        }
      );

      return reply.status(200).send({ ok: true, queued: connected.id });
    }
  );
}
