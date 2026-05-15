import { FastifyReply, FastifyRequest } from "fastify";
import { BinanceService } from "./binance.service.js";

interface CredentialsBody { apiKey: string; apiSecret: string }
interface SymbolParams { symbol: string }
interface OrderBody { asset: string; amountBrl: number; biometricToken: string }
interface OrdersQuery { cursor?: string; limit?: number }

export class BinanceController {
  private readonly service = new BinanceService();

  connect = async (req: FastifyRequest<{ Body: CredentialsBody }>, reply: FastifyReply) => {
    await this.service.connect(req.userId, req.body.apiKey, req.body.apiSecret);
    return reply.status(201).send({ status: "connected" });
  };

  replace = async (req: FastifyRequest<{ Body: CredentialsBody }>, reply: FastifyReply) => {
    await this.service.replace(req.userId, req.body.apiKey, req.body.apiSecret);
    return reply.send({ status: "replaced" });
  };

  disconnect = async (req: FastifyRequest, reply: FastifyReply) => {
    await this.service.disconnect(req.userId);
    return reply.status(204).send();
  };

  wallet = async (req: FastifyRequest, reply: FastifyReply) => {
    const wallet = await this.service.getWallet(req.userId);
    return reply.send(wallet);
  };

  quote = async (req: FastifyRequest<{ Params: SymbolParams }>, reply: FastifyReply) => {
    const quote = await this.service.getQuote(req.params.symbol);
    return reply.send(quote);
  };

  placeOrder = async (req: FastifyRequest<{ Body: OrderBody }>, reply: FastifyReply) => {
    const order = await this.service.placeOrder(
      req.userId,
      req.body.asset,
      req.body.amountBrl,
      req.body.biometricToken
    );
    return reply.status(201).send(order);
  };

  listOrders = async (req: FastifyRequest<{ Querystring: OrdersQuery }>, reply: FastifyReply) => {
    const result = await this.service.listOrders(req.userId, req.query.cursor, req.query.limit ?? 30);
    return reply.send(result);
  };
}
