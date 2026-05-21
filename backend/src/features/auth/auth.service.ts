import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { AuthRepository } from "./auth.repository.js";
import { prisma } from "../../config/database.js";
import { Errors } from "../../lib/errors.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../lib/jwt.js";
import { redis } from "../../lib/redis.js";
import { env } from "../../config/env.js";

const SALT_ROUNDS = 12;
const BIOMETRIC_TTL = 60;
const BIOMETRIC_PREFIX = "biometric:";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string; name: string | null };
}

export class AuthService {
  private readonly repo = new AuthRepository();

  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    const normalized = email.toLowerCase().trim();
    const existing = await this.repo.findUserByEmail(normalized);
    if (existing) throw Errors.Conflict("Email já cadastrado");

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await this.repo.createUser(normalized, passwordHash, name?.trim() || null);
    const tokens = await this.issueTokens(user.id);

    return { user: { id: user.id, email: user.email, name: user.name }, ...tokens };
  }

  async login(email: string, password: string, deviceInfo?: string): Promise<AuthResult> {
    const normalized = email.toLowerCase().trim();
    const user = await this.repo.findUserByEmail(normalized);
    if (!user) throw Errors.InvalidCredentials();

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Errors.InvalidCredentials();

    const tokens = await this.issueTokens(user.id, deviceInfo);
    return { user: { id: user.id, email: user.email, name: user.name }, ...tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw Errors.Unauthorized("Refresh token inválido");
    }

    const session = await this.repo.findSessionById(payload.sid);
    if (!session) throw Errors.Unauthorized("Sessão não encontrada");

    // Detecção de reutilização: se já foi marcado como usado, revoga toda a família.
    if (session.usedAt || session.revokedAt) {
      await this.repo.revokeAllSessionsOfUser(session.userId);
      throw Errors.Forbidden("Reutilização de refresh token detectada — sessões revogadas");
    }

    const matches = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!matches) {
      // Token não confere com o hash → potencial ataque, revoga toda a família
      await this.repo.revokeAllSessionsOfUser(session.userId);
      throw Errors.Forbidden("Refresh token não corresponde — sessões revogadas");
    }

    if (session.expiresAt.getTime() < Date.now()) {
      await this.repo.markSessionRevoked(session.id);
      throw Errors.Unauthorized("Sessão expirada");
    }

    // Rotação: marca a sessão atual como usada e cria uma nova.
    const newTokens = await this.issueTokens(session.userId, session.deviceInfo ?? undefined);
    await this.repo.markSessionUsedAndReplaced(session.id, newTokens.sessionId);

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: newTokens.expiresIn,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await this.repo.markSessionRevoked(payload.sid);
    } catch {
      // Ignora token inválido — logout deve ser idempotente
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthTokens> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.NotFound("Usuário não encontrado");

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw Errors.Unauthorized("Senha atual incorreta");

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.repo.updatePassword(userId, passwordHash);
    // Segurança: revoga TODAS as sessões (incluindo outros devices) e emite uma
    // nova só pra este device, devolvida pra o app salvar — assim quem trocou a
    // senha continua logado e qualquer outro device cai.
    await this.repo.revokeAllSessionsOfUser(userId);
    const tokens = await this.issueTokens(userId, user.email);
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn };
  }

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.NotFound("Usuário não encontrado");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Errors.Unauthorized("Senha incorreta");

    await this.repo.deleteUserCascade(userId);
  }

  async getMe(userId: string): Promise<{ id: string; email: string; name: string | null; createdAt: Date }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.NotFound("Usuário não encontrado");
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
  }

  async createBiometricChallenge(userId: string): Promise<string> {
    const token = uuidv4();
    await redis.set(`${BIOMETRIC_PREFIX}${token}`, userId, "EX", BIOMETRIC_TTL);
    return token;
  }

  async savePushToken(userId: string, pushToken: string | null): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { pushToken } });
  }

  /**
   * Consome o token biométrico atomicamente (GET + DELETE) usando GETDEL.
   */
  async consumeBiometricChallenge(token: string, userId: string): Promise<void> {
    const stored = await redis.getdel(`${BIOMETRIC_PREFIX}${token}`);
    if (!stored || stored !== userId) {
      throw Errors.InvalidBiometric();
    }
  }

  private async issueTokens(
    userId: string,
    deviceInfo?: string
  ): Promise<AuthTokens & { sessionId: string }> {
    const sessionId = uuidv4();
    const refreshToken = signRefreshToken(userId, sessionId);
    const refreshHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);

    await this.repo.createSession({
      id: sessionId,
      userId,
      refreshTokenHash: refreshHash,
      expiresAt,
      deviceInfo,
    });

    const accessToken = signAccessToken(userId);
    return { sessionId, accessToken, refreshToken, expiresIn: 15 * 60 };
  }
}
