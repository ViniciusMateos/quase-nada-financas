import { FastifyReply, FastifyRequest } from "fastify";
import { AccountsService } from "./accounts.service.js";

interface ListQuery { forceSync?: boolean }
interface IdParams { connectedAccountId: string }
interface CallbackBody { itemId: string }

export class AccountsController {
  private readonly service = new AccountsService();

  list = async (req: FastifyRequest<{ Querystring: ListQuery }>, reply: FastifyReply) => {
    const accounts = await this.service.listAccounts(req.userId, req.query.forceSync ?? false);
    return reply.send({ accounts });
  };

  remove = async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    await this.service.removeAccount(req.userId, req.params.connectedAccountId);
    return reply.status(204).send();
  };

  sync = async (req: FastifyRequest<{ Params: IdParams }>, reply: FastifyReply) => {
    const result = await this.service.syncAccount(req.userId, req.params.connectedAccountId);
    return reply.send(result);
  };

  pluggyConnectToken = async (req: FastifyRequest, reply: FastifyReply) => {
    const token = await this.service.createPluggyConnectToken(req.userId);
    return reply.send({ connectToken: token });
  };

  pluggyCallback = async (req: FastifyRequest<{ Body: CallbackBody }>, reply: FastifyReply) => {
    const result = await this.service.handlePluggyCallback(req.userId, req.body.itemId);
    return reply.status(201).send(result);
  };
}
