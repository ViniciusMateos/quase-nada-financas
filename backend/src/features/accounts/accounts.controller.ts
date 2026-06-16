import { FastifyReply, FastifyRequest } from "fastify";
import { AccountsService } from "./accounts.service.js";

interface ListQuery { forceSync?: boolean }
interface IdParams { connectedAccountId: string }
interface CallbackBody { itemId: string }
interface ConnectTokenBody { oauthRedirectUri?: string }
interface RenameBody { customName: string | null }
interface BankAccountIdParams { bankAccountId: string }
interface CreditCloseDayBody { creditCloseDay: number | null }
interface CreditDueDayBody { creditDueDay: number | null }

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

  pluggyConnectToken = async (req: FastifyRequest<{ Body: ConnectTokenBody }>, reply: FastifyReply) => {
    const { token, meuPluggyConnectorId } = await this.service.createPluggyConnectToken(
      req.userId,
      req.body?.oauthRedirectUri
    );
    return reply.send({ connectToken: token, meuPluggyConnectorId });
  };

  pluggyCallback = async (req: FastifyRequest<{ Body: CallbackBody }>, reply: FastifyReply) => {
    const result = await this.service.handlePluggyCallback(req.userId, req.body.itemId);
    return reply.status(201).send(result);
  };

  rename = async (req: FastifyRequest<{ Params: IdParams; Body: RenameBody }>, reply: FastifyReply) => {
    const updated = await this.service.renameAccount(req.userId, req.params.connectedAccountId, req.body.customName);
    return reply.send(updated);
  };

  setCreditCloseDay = async (
    req: FastifyRequest<{ Params: BankAccountIdParams; Body: CreditCloseDayBody }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.setCreditCloseDay(
      req.userId,
      req.params.bankAccountId,
      req.body.creditCloseDay
    );
    return reply.send(result);
  };

  setCreditDueDay = async (
    req: FastifyRequest<{ Params: BankAccountIdParams; Body: CreditDueDayBody }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.setCreditDueDay(
      req.userId,
      req.params.bankAccountId,
      req.body.creditDueDay
    );
    return reply.send(result);
  };
}
