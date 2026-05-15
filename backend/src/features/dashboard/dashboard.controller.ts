import { FastifyReply, FastifyRequest } from "fastify";
import { DashboardService } from "./dashboard.service.js";

interface DashboardQuery { month?: string }

export class DashboardController {
  private readonly service = new DashboardService();

  get = async (req: FastifyRequest<{ Querystring: DashboardQuery }>, reply: FastifyReply) => {
    const month = req.query.month ?? defaultMonth();
    const data = await this.service.getDashboard(req.userId, month);
    return reply.send(data);
  };
}

function defaultMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
