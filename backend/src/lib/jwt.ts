import jwt, { type SignOptions, type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  type: "access";
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  sid: string;
  type: "refresh";
}

export function signAccessToken(userId: string): string {
  const opts: SignOptions = { expiresIn: env.JWT_ACCESS_TTL as SignOptions["expiresIn"] };
  return jwt.sign({ sub: userId, type: "access" }, env.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(userId: string, sessionId: string): string {
  const opts: SignOptions = { expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d` };
  return jwt.sign({ sub: userId, sid: sessionId, type: "refresh" }, env.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== "access") throw new Error("Invalid token type");
  return decoded;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (decoded.type !== "refresh") throw new Error("Invalid token type");
  return decoded;
}
