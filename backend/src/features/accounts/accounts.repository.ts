import { prisma } from "../../config/database.js";
import type { BankAccount, ConnectedAccount } from "@prisma/client";

export class AccountsRepository {
  upsertConnectedAccount(data: {
    userId: string;
    pluggyItemId: string;
    bankName: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    consentExpiresAt: Date | null;
    status: string;
  }): Promise<ConnectedAccount> {
    return prisma.connectedAccount.upsert({
      where: { pluggyItemId: data.pluggyItemId },
      update: {
        bankName: data.bankName,
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? null,
        consentExpiresAt: data.consentExpiresAt,
        status: data.status,
      },
      create: data,
    });
  }

  upsertBankAccount(data: {
    connectedAccountId: string;
    externalId: string;
    type: string;
    balance: number;
    currency: string;
    lastSyncAt: Date;
  }): Promise<BankAccount> {
    return prisma.bankAccount.upsert({
      where: {
        connectedAccountId_externalId: {
          connectedAccountId: data.connectedAccountId,
          externalId: data.externalId,
        },
      },
      update: {
        type: data.type,
        balance: data.balance,
        currency: data.currency,
        lastSyncAt: data.lastSyncAt,
      },
      create: data,
    });
  }

  findConnectedAccountById(id: string): Promise<ConnectedAccount | null> {
    return prisma.connectedAccount.findUnique({ where: { id } });
  }

  findBankAccountByExternal(
    connectedAccountId: string,
    externalId: string
  ): Promise<BankAccount | null> {
    return prisma.bankAccount.findUnique({
      where: { connectedAccountId_externalId: { connectedAccountId, externalId } },
    });
  }

  findConnectedAccountsByUser(userId: string): Promise<ConnectedAccount[]> {
    return prisma.connectedAccount.findMany({ where: { userId, status: "ACTIVE" } });
  }

  findAccountsWithBankAccounts(userId: string) {
    return prisma.connectedAccount.findMany({
      where: { userId },
      include: { bankAccounts: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteConnectedAccount(id: string): Promise<void> {
    await prisma.connectedAccount.delete({ where: { id } });
  }

  async touchConnectedAccount(id: string): Promise<void> {
    await prisma.connectedAccount.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }
}
