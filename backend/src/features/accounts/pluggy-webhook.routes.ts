import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../../config/database.js";
import { pluggySyncQueue } from "../../lib/queue.js";
import { logger } from "../../lib/logger.js";

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

export async function pluggyWebhookRoutes(app: FastifyInstance): Promise<void> {
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
