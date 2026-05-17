# Changelog

Todas as mudancas notaveis deste projeto sao documentadas aqui.
O formato segue Keep a Changelog e o versionamento segue Semantic Versioning.

## [0.2.0] - 2026-05-16

### Added

- Schema: `ConnectedAccount.logoUrl` e `primaryColor`; `Transaction.isSubscriptionOverride`.
- Webhook Pluggy auto-cria `ConnectedAccount` em `item/created` e `item/updated`
  quando o callback do app ainda nao chegou (usa `clientUserId`).
- Pluggy `connect-token` aceita `oauthRedirectUri` (suporte a Itau e outros OAuth).
- Persiste logo e cor primaria do banco em cada sync da conta.
- Modulo analytics no backend: `GET /subscriptions`, `GET /categories/stats`
  e `GET /installments`.
- Categoria padrao "Pagamento de fatura" como transferencia interna,
  excluida automaticamente dos summaries.
- `GET /transactions/summary`: income/expense/net/count por periodo.
- `POST /transactions/recategorize`: reprocessa categoria de todas as
  transacoes do usuario com as regras atuais.
- `GET /transactions/:id/similar`: ate 10 transacoes parecidas.
- `PATCH /transactions/:id`: update generico (alias, categoria,
  override de assinatura) com propagacao para similares.
- Filtro `accountType=BANK|CREDIT` em `GET /transactions`.
- Keyword matching como 4o estagio da categorizacao automatica.
- `ThemeProvider` claro/escuro no app mobile com paletas dedicadas.
- Top tabs novas: Categorias, Assinaturas e Parcelamentos.
- Telas novas: `CategoriesScreen`, `CategoryDetailScreen`,
  `SubscriptionsScreen`, `InstallmentsScreen`, `EditTransactionSheet`.
- Componentes UI novos: `AnimatedNumber`, `BankBadge`, `BottomSheet`,
  `PeriodPickerSheet`, `Screen`, `ScreenHeader`, `TabBarPills`,
  `TabScreen`, `TopTabBar`.
- Material da aula de deploy na Oracle em `docs/`.

### Changed

- Dashboard `byCategory` vira `topCategories` (top 6 com `percentage`).
- Sync incremental usa o `lastSyncAt` anterior ao upsert (corrige perda
  da janela incremental por upsert antes do calculo).
- Sinal do `amount` da transacao normalizado pelo `type` do Pluggy
  (DEBIT negativo, CREDIT positivo) ao ingerir.
- Listagem de transacoes retorna shape rico (alias, accountLogoUrl,
  originalDescription, categoryColor).
- Bottom tabs migrados para top tabs (`TopTabBar`) com nova ordem de IA.
- Cards de conta agora exibem `BankBadge` (logo do banco) e somatorio
  por sub-conta + fatura.
- `Button`, `Cards`, `FormError`, `States`, `TextField` refatorados para
  consumir `useTheme()` em vez do token estatico.
- `apiClient`: pattern de auth endpoints estendido para nao retentar
  refresh em `/auth/login|register|biometric-challenge`.
- `formatters.ts` aceita `null`/`undefined`.
- `docker-compose`: ports do PostgreSQL e Redis em `127.0.0.1` (nao expoe
  na rede local).
- `Dockerfile`: copia `node_modules/prisma` para o runtime image.
- `tsconfig`: remove `prisma/**` do `include`.
- Tipagem dos `responseData`/`rawData`: `Prisma.InputJsonValue` em vez de
  `Record<string, unknown>`.
- Substitui `EditCategorySheet` por `EditTransactionSheet` (modal unico
  para alias + categoria + override de assinatura).

### Fixed

- Typo no comando `cp .env.example .env` do README (`/` solta no fim).

## [0.1.0] - 2026-05-12

### Added

- Backend Fastify + TypeScript com Prisma/PostgreSQL.
- Redis + BullMQ para sincronizacao Pluggy.
- Autenticacao JWT com access token, refresh token e logout.
- Endpoints `/auth`, `/accounts`, `/pluggy`, `/transactions`, `/categories`, `/dashboard` e `/binance`.
- Integracao Pluggy para contas bancarias e transacoes.
- Integracao Binance para carteira, cotacoes e ordens.
- Challenge token efemero para ordens financeiras.
- App mobile React Native + Expo com navegacao protegida.
- SecureStore para tokens no iOS.
- Cache offline com AsyncStorage.
- Pluggy Connect em WebView.
- Biometria para confirmar ordens Binance.
- Dockerfile multi-stage, Compose local e pipeline GitHub Actions.
- Guia de deploy, rollback, API Reference e CONTRIBUTING.

### Security

- Tokens armazenados em SecureStore no mobile.
- Segredos externos somente via variaveis de ambiente.
- Credenciais Binance criptografadas com `ENCRYPTION_KEY`.
- Rate limit em login e ordens.
