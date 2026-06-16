-- Campos de cartão de crédito pra exibir fatura/vencimento e disparar lembretes.
-- Todos nullable e aditivos (seguro em produção).
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "creditDueDay" INTEGER;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "minimumPayment" DOUBLE PRECISION;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "creditLimit" DOUBLE PRECISION;
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "creditBrand" TEXT;
