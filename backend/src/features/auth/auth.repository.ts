import { prisma } from "../../config/database.js";
import type { Session, User } from "@prisma/client";

export class AuthRepository {
  findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  createUser(email: string, passwordHash: string): Promise<User> {
    return prisma.user.create({ data: { email, passwordHash } });
  }

  findSessionById(id: string): Promise<Session | null> {
    return prisma.session.findUnique({ where: { id } });
  }

  createSession(data: {
    id: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo?: string;
  }): Promise<Session> {
    return prisma.session.create({ data });
  }

  markSessionUsedAndReplaced(sessionId: string, replacedById: string): Promise<Session> {
    return prisma.session.update({
      where: { id: sessionId },
      data: { usedAt: new Date(), replacedById },
    });
  }

  markSessionRevoked(sessionId: string): Promise<Session> {
    return prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsOfUser(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
