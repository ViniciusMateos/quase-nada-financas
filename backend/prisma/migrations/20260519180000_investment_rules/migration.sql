-- CreateTable
CREATE TABLE "InvestmentRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL,
    "triggerDay" INTEGER,
    "triggerMinAmount" DOUBLE PRECISION,
    "actionType" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amountBrl" DOUBLE PRECISION NOT NULL,
    "maxAmountBrl" DOUBLE PRECISION,
    "maxFiresPerMonth" INTEGER NOT NULL DEFAULT 2,
    "firesThisMonth" INTEGER NOT NULL DEFAULT 0,
    "firesMonthRef" TIMESTAMP(3),
    "lastFiredAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentRule_userId_active_idx" ON "InvestmentRule"("userId", "active");
CREATE INDEX "InvestmentRule_triggerType_active_idx" ON "InvestmentRule"("triggerType", "active");

-- AddForeignKey
ALTER TABLE "InvestmentRule" ADD CONSTRAINT "InvestmentRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InvestmentPendingAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT,
    "actionType" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amountBrl" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "resultMessage" TEXT,
    "executedOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentPendingAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvestmentPendingAction_userId_status_idx" ON "InvestmentPendingAction"("userId", "status");
CREATE INDEX "InvestmentPendingAction_status_dueAt_idx" ON "InvestmentPendingAction"("status", "dueAt");

-- AddForeignKey
ALTER TABLE "InvestmentPendingAction" ADD CONSTRAINT "InvestmentPendingAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestmentPendingAction" ADD CONSTRAINT "InvestmentPendingAction_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "InvestmentRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
