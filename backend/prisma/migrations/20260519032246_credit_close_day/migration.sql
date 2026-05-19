-- BankAccount.creditCloseDay: dia do mês (1-31) configurável manualmente
-- pelo usuário pra cartões cujo conector não envia creditData confiável.
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "creditCloseDay" INTEGER;
