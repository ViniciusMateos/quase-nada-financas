import { FastifyReply, FastifyRequest } from "fastify";
import { TransactionsService } from "./transactions.service.js";

interface ListQuery {
  cursor?: string;
  limit?: number;
  accountId?: string;
  accountType?: 'BANK' | 'CREDIT';
  startDate?: string;
  endDate?: string;
  categoryId?: string;
}
interface UpdateCategoryParams { transactionId: string }
interface UpdateCategoryBody { categoryId: string; createRule?: boolean }
interface UpdateTransactionParams { transactionId: string }
interface UpdateTransactionBody {
  alias?: string | null;
  categoryId?: string;
  isSubscriptionOverride?: boolean | null;
}

export class TransactionsController {
  private readonly service = new TransactionsService();

  list = async (req: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const result = await this.service.listTransactions(req.userId, {
      cursor: req.query.cursor,
      limit: req.query.limit ?? 30,
      accountId: req.query.accountId,
      accountType: req.query.accountType,
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

  summary = async (req: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const result = await this.service.summary(req.userId, {
      accountId: req.query.accountId,
      accountType: req.query.accountType,
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
    });
    return reply.send(result);
  };

  recategorize = async (req: FastifyRequest, reply: FastifyReply) => {
    const result = await this.service.recategorizeAll(req.userId);
    return reply.send(result);
  };

  similar = async (req: FastifyRequest<{ Params: UpdateCategoryParams }>, reply: FastifyReply) => {
    const items = await this.service.listSimilar(req.userId, req.params.transactionId);
    return reply.send({ items });
  };

  updateTransaction = async (
    req: FastifyRequest<{ Params: UpdateTransactionParams; Body: UpdateTransactionBody }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.updateTransaction(
      req.userId,
      req.params.transactionId,
      req.body
    );
    return reply.send(result);
  };
}
