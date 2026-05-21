import { FastifyReply, FastifyRequest } from "fastify";
import { PortfolioService } from "./portfolio.service.js";

interface InvestmentTxParams { id: string }

export class PortfolioController {
  private readonly service = new PortfolioService();

  get = async (req: FastifyRequest, reply: FastifyReply) => {
    const portfolio = await this.service.getPortfolio(req.userId);
    return reply.send(portfolio);
  };

  investmentTransactions = async (req: FastifyRequest<{ Params: InvestmentTxParams }>, reply: FastifyReply) => {
    const movements = await this.service.getInvestmentTransactions(req.userId, req.params.id);
    return reply.send({ movements });
  };
}
