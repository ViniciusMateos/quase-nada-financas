import { FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "../lib/jwt.js";
import { Errors } from "../lib/errors.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw Errors.Unauthorized("Bearer token ausente");
  }
  const token = header.slice(7).trim();
  if (!token) throw Errors.Unauthorized("Bearer token vazio");

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
  } catch {
    throw Errors.Unauthorized("Token inválido ou expirado");
  }
}
