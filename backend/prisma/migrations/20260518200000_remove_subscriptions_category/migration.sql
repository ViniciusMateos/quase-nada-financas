-- Move transações da categoria "Assinaturas" → "Serviços"
UPDATE "Transaction"
SET "categoryId" = '00000000-0000-4000-8000-00000000000A'
WHERE "categoryId" = '00000000-0000-4000-8000-00000000000B';

-- Move regras de categorização também
UPDATE "CategoryRule"
SET "categoryId" = '00000000-0000-4000-8000-00000000000A'
WHERE "categoryId" = '00000000-0000-4000-8000-00000000000B';

-- Remove a categoria "Assinaturas" (a aba dedicada continua via analytics)
DELETE FROM "Category" WHERE id = '00000000-0000-4000-8000-00000000000B';
