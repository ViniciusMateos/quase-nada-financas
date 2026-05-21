import { FastifyReply, FastifyRequest } from "fastify";
import { InvestmentsService, CreateRuleInput, UpdateRuleInput } from "./investments.service.js";

interface RuleParams { ruleId: string }
interface PendingParams { pendingId: string }
interface ListPendingQuery { includeFinalized?: boolean }

export class InvestmentsController {
  private readonly service = new InvestmentsService();

  listRules = async (req: FastifyRequest, reply: FastifyReply) => {
    const rules = await this.service.listRules(req.userId);
    return reply.send({ rules });
  };

  createRule = async (
    req: FastifyRequest<{ Body: CreateRuleInput }>,
    reply: FastifyReply
  ) => {
    const rule = await this.service.createRule(req.userId, req.body);
    return reply.status(201).send(rule);
  };

  updateRule = async (
    req: FastifyRequest<{ Params: RuleParams; Body: UpdateRuleInput }>,
    reply: FastifyReply
  ) => {
    const rule = await this.service.updateRule(req.userId, req.params.ruleId, req.body);
    return reply.send(rule);
  };

  deleteRule = async (
    req: FastifyRequest<{ Params: RuleParams }>,
    reply: FastifyReply
  ) => {
    await this.service.deleteRule(req.userId, req.params.ruleId);
    return reply.status(204).send();
  };

  listPending = async (
    req: FastifyRequest<{ Querystring: ListPendingQuery }>,
    reply: FastifyReply
  ) => {
    const items = await this.service.listPending(req.userId, req.query.includeFinalized ?? false);
    return reply.send({ items });
  };

  approvePending = async (
    req: FastifyRequest<{ Params: PendingParams }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.approve(req.userId, req.params.pendingId);
    return reply.send(result);
  };

  dismissPending = async (
    req: FastifyRequest<{ Params: PendingParams }>,
    reply: FastifyReply
  ) => {
    const result = await this.service.dismiss(req.userId, req.params.pendingId);
    return reply.send(result);
  };
}
