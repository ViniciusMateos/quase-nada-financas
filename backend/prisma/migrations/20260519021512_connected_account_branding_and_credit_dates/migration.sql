-- ConnectedAccount: branding do banco vindo do Pluggy (logo + cor).
-- IF NOT EXISTS porque em alguns ambientes essas colunas já foram aplicadas
-- via "prisma db push" antes de existirem como migration.
ALTER TABLE "ConnectedAccount" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "ConnectedAccount" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;

-- BankAccount: datas do ciclo de fatura (cartão de crédito) vindas do
-- creditData da Pluggy. Usadas para calcular a fatura aberta no dashboard.
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "creditCloseDate" TIMESTAMP(3);
ALTER TABLE "BankAccount" ADD COLUMN IF NOT EXISTS "creditDueDate" TIMESTAMP(3);
