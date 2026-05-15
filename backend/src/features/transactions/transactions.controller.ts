import { FastifyReply, FastifyRequest } from "fastify";
import { TransactionsService } from "./transactions.service.js";

interface ListQuery {
  cursor?: string;
  limit?: number;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  categoryId?: string;
}
interface UpdateCategoryParams { transactionId: string }
interface UpdateCategoryBody { categoryId: string; createRule?: boolean }

export class TransactionsController {
  private readonly service = new TransactionsService();

  list = async (req: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const result = await this.service.listTransactions(req.userId, {
      cursor: req.query.cursor,
      limit: req.query.limit ?? 30,
      accountId: req.query.accountId,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
      categoryId: req.query.categoryId,
    });
    return reply.send(result);
  };

  updateCategory = async (
    req: FastifyRequest<{ Params: UpdateCategoryParams; Body: UpdateCategoryBody }>,
    reply: FastifyReply
  ) => {
    const tx = await this.service.updateCategory(
      req.userId,
      req.params.transactionId,
      req.body.categoryId,
      req.body.createRule ?? false
    );
    return reply.send(tx);
  };
}
