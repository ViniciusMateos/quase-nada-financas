# Quase Nada Financas

![CI](https://img.shields.io/badge/ci-github_actions-2088FF)
![Backend](https://img.shields.io/badge/backend-Fastify%20%2B%20Prisma-111827)
![Mobile](https://img.shields.io/badge/mobile-Expo%20React%20Native-22C55E)
![License](https://img.shields.io/badge/license-private-lightgrey)

App de financas pessoais com contas via Open Finance/Pluggy, transacoes categorizadas, dashboard mensal e investimentos Binance. Backend Node.js/Fastify e app mobile React Native + Expo para build iOS via EAS no Windows.

## Features

- Autenticacao JWT com access token, refresh token e logout.
- Dashboard com saldo total, receitas, despesas, top categorias (com %) e transacoes recentes.
- Contas bancarias via Pluggy Connect (SDK nativo), com logo e cor do banco.
- Webhook Pluggy auto-cria contas quando o callback chega antes do retorno do app.
- Transacoes com filtros por conta/tipo (BANK/CREDIT), busca, paginacao por cursor,
  edicao de alias, categoria e override de assinatura (propaga para similares).
- Categorias com drill-down por periodo e categorizacao automatica por
  regras do usuario, MCC e keyword matching.
- Detecção de assinaturas recorrentes (mensal/anual) com projecao de gasto.
- Parcelamentos: progresso, valor pago, restante e data estimada da ultima parcela.
- Estimativa de fatura aberta do cartao em 3 camadas (dia de fechamento
  configuravel manualmente, ultimo pagamento, balance da Pluggy).
- Atualizacao automatica entre telas via `DataRefreshContext` —
  conectou conta, sincronizou, editou transacao? Outras telas
  refazem fetch sozinhas, sem reiniciar app.
- Binance: conexao por API key, carteira, cotacoes e ordens com biometria.
- Tema claro/escuro com `ThemeProvider` e paletas dedicadas (fade sem flash).
- Cache offline para dados principais.
- Deploy backend com Docker, PostgreSQL, Redis e GitHub Actions.
- Build iOS interno via EAS `preview`.

## Quickstart Backend

```bash
cd backend
cp .env.example .env
npm ci
docker compose up -d postgres redis
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

API disponivel em `http://localhost:3000/api/v1`. Health check em `http://localhost:3000/health`.

## Quickstart Mobile

```bash
cd frontend
npm ci
cp .env.example .env
npx expo start
```

Para instalar no iPhone via QR code:

```bash
cd frontend
npx eas login
npx eas build --profile preview --platform ios
```

## Pre-requisitos

| Ferramenta | Versao minima | Uso |
|------------|---------------|-----|
| Node.js | 20.x | Backend, Expo CLI e tooling. |
| npm | 10.x | Instalacao de dependencias. |
| Docker Desktop | 24.x | PostgreSQL, Redis e build local. |
| Docker Compose | 2.x | Orquestracao local. |
| Expo account | Ativa | EAS Build iOS. |
| Apple Developer Account | Ativa | Distribuicao interna iOS. |

## Estrutura

```text
backend/
  prisma/
  src/
    config/
    features/
    integrations/
    lib/
    middleware/
    workers/
frontend/
  app.config.js
  eas.json
  src/
    contexts/
    hooks/
    lib/
    navigation/
    screens/
    services/
    theme/
    ui/
```

## Scripts Backend

| Script | Descricao |
|--------|-----------|
| `npm run dev` | API em desenvolvimento com `tsx watch`. |
| `npm run build` | Compila TypeScript para `dist/`. |
| `npm run start` | Inicia `dist/server.js`. |
| `npm run worker` | Inicia worker de sync Pluggy. |
| `npm run prisma:generate` | Gera Prisma Client. |
| `npm run prisma:migrate` | Cria/aplica migracoes em dev. |
| `npm run prisma:deploy` | Aplica migracoes em producao. |
| `npm run lint` | ESLint em `src/**/*.ts`. |
| `npm run typecheck` | TypeScript sem emitir arquivos. |

## Troubleshooting

### `Invalid environment variables`

Copie `.env.example`, preencha os obrigatorios e garanta que `ENCRYPTION_KEY` tenha 64 caracteres hex.

### `ECONNREFUSED 127.0.0.1:5432`

PostgreSQL nao esta rodando. Rode `docker compose up -d postgres` e aguarde o health check.

### `Redis connection refused`

Redis nao esta ativo ou `REDIS_URL` aponta para host errado. Rode `docker compose up -d redis`.

### Prisma `P1001` ou `P3005`

Confirme `DATABASE_URL`; em desenvolvimento descartavel, use `npx prisma migrate reset`.

### App iPhone nao acessa API local

No iPhone, `localhost` aponta para o proprio aparelho. Use `http://IP_DA_MAQUINA:3000/api/v1` em dev ou uma URL HTTPS publica no EAS preview.

### Face ID nao aparece no Expo Go

Face ID exige development build com `NSFaceIDUsageDescription`. Use EAS `development` ou `preview`.

## Documentacao

- API e deploy: `DEPLOY.md`
- Contribuicao: `CONTRIBUTING.md`
- Historico: `CHANGELOG.md`

## Licenca

Projeto privado da Quase Nada Software House.
