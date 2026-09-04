-- Nome do titular (como aparece em transferências) para detectar auto-transferência (PIX pra si mesmo).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "selfName" TEXT;
