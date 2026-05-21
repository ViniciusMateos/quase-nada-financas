import { FastifyReply, FastifyRequest } from "fastify";
import { AnalyticsService } from "./analytics.service.js";

interface CategoryStatsQuery {
  month?: string;
  startDate?: string;
  endDate?: string;
}

export class AnalyticsController {
  private readonly service = new AnalyticsService();

  subscriptions = async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = await this.service.getSubscriptions(req.userId);
    return reply.send(payload);
  };

  categoryStats = async (req: FastifyRequest<{ Querystring: CategoryStatsQuery }>, reply: FastifyReply) => {
    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      const payload = await this.service.getCategoryStats(req.userId, { startDate, endDate });
      return reply.send(payload);
    }
    const month = req.query.month ?? defaultMonth();
    const payload = await this.service.getCategoryStats(req.userId, { month });
    return reply.send(payload);
  };

  installments = async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = await this.service.getInstallments(req.userId);
    return reply.send(payload);
  };

  weeklySummary = async (req: FastifyRequest, reply: FastifyReply) => {
    const payload = await this.service.getWeeklySummary(req.userId);
    return reply.send(payload);
  };
}

function defaultMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
