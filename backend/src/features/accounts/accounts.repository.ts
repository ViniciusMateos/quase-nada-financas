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
    subtype?: string | null;
    name?: string | null;
    marketingName?: string | null;
    number?: string | null;
    balance: number;
    currency: string;
    lastSyncAt: Date;
    creditCloseDate?: Date | null;
    creditDueDate?: Date | null;
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
        subtype: data.subtype ?? null,
        name: data.name ?? null,
        marketingName: data.marketingName ?? null,
        number: data.number ?? null,
        balance: data.balance,
        currency: data.currency,
        lastSyncAt: data.lastSyncAt,
        creditCloseDate: data.creditCloseDate ?? null,
        creditDueDate: data.creditDueDate ?? null,
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

  async setCustomName(id: string, customName: string | null): Promise<ConnectedAccount> {
    return prisma.connectedAccount.update({
      where: { id },
      data: { customName },
    });
  }

  async touchConnectedAccount(id: string): Promise<void> {
    await prisma.connectedAccount.update({
      where: { id },
      data: { updatedAt: new Date() },
    });
  }
}
