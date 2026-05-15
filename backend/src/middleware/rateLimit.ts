import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { redis } from "../lib/redis.js";
import { Errors } from "../lib/errors.js";

interface RateLimitOptions {
  keyPrefix: string;
  max: number;
  windowSeconds: number;
  keyExtractor: (req: FastifyRequest) => string;
}

/**
 * Rate limiter por janela fixa em Redis com pipeline atômico (RC-04).
 * INCR + EXPIRE em pipeline garante que o TTL sempre é definido, evitando
 * chaves sem expiração que causariam lock-out permanente em falha parcial.
 */
export function rateLimit(opts: RateLimitOptions): preHandlerHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const id = opts.keyExtractor(req);
    if (!id) return;
    const key = `${opts.keyPrefix}:${id}`;

    // Pipeline atômico: INCR e EXPIRE na mesma roundtrip
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, opts.windowSeconds, "NX"); // NX: só define se não existe, preserva TTL original
    const results = await pipeline.exec();
    const count = (results?.[0]?.[1] as number) ?? 0;

    if (count > opts.max) {
      throw Errors.TooManyRequests(
        `Limite de ${opts.max} requisições em ${opts.windowSeconds}s atingido`
      );
    }
  };
}
