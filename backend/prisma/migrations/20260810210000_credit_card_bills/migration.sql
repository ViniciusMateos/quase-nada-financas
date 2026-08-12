-- Fatura oficial do Pluggy (/bills): valor exato + vencimento da fatura mais recente.
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "billAmount" DOUBLE PRECISION;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "billDueDate" TIMESTAMP(3);
