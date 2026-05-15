# Contributing - Quase Nada Financas

## Branches

| Tipo | Formato | Exemplo |
|------|---------|---------|
| Feature | `feature/descricao-curta` | `feature/mobile-expo-dashboard` |
| Fix | `fix/descricao-curta` | `fix/refresh-token-401` |
| Chore | `chore/descricao-curta` | `chore/eas-preview-profile` |
| Docs | `docs/descricao-curta` | `docs/api-binance-orders` |
| Release | `release/vX.Y.Z` | `release/v1.0.0` |

## Commits

Use formato simples:

```text
feat: adicionar fluxo de login Expo
fix: corrigir refresh automatico em 401
docs: atualizar guia de deploy EAS
chore: configurar Dockerfile multi-stage
```

Tipos aceitos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Checklist de PR

- [ ] `npm run lint` passou no backend ou mobile afetado.
- [ ] `npm run typecheck` passou.
- [ ] Migracoes Prisma revisadas quando houver alteracao de schema.
- [ ] `.env.example` atualizado para novas variaveis.
- [ ] API Reference atualizada quando endpoint mudar.
- [ ] CHANGELOG atualizado para mudancas visiveis.
- [ ] Nenhum secret em codigo, logs, docs ou screenshots.

## Processo de Revisao

1. Abrir PR com resumo objetivo e evidencias de teste.
2. Esperar CI passar.
3. Corrigir comentarios bloqueadores.
4. Fazer squash merge para `main`.
5. Deploy automatico roda apos merge em `main`.
