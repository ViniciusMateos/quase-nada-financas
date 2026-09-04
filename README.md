# Quase Nada Financas

![CI](https://img.shields.io/badge/ci-github_actions-2088FF)
![Backend](https://img.shields.io/badge/backend-Fastify%20%2B%20Prisma-111827)
![Mobile](https://img.shields.io/badge/mobile-Expo%20React%20Native-22C55E)
![License](https://img.shields.io/badge/license-private-lightgrey)
![Status](https://img.shields.io/badge/status-arquivado%20%C2%B7%20material%20de%20estudo-lightgrey)

> **Status: arquivado — material de estudo (set/2026).** Projetinho de financas
> pessoais que a gente foi tocando por um tempo e deu pra aprender bastante no
> caminho (full-stack de verdade). Acabou nao fazendo mais sentido manter de pe, entao
> o backend foi desligado e o codigo fica aqui so como referencia/estudo. Ja era.

App de financas pessoais com contas via Open Finance/Pluggy, transacoes categorizadas, dashboard mensal e investimentos Binance. Backend Node.js/Fastify e app mobile React Native + Expo para build iOS via EAS no Windows.

## Features

- Autenticacao JWT com access token, refresh token e logout.
- Dashboard com saldo total, receitas, despesas, top categorias (com %) e transacoes recentes.
- Contas bancarias via Pluggy Connect (SDK nativo), com logo e cor do banco — conexao direta pelo MeuPluggy.
- Multiplas contas salvas com hub de selecao e login rapido por Face ID (refresh token no SecureStore); app lock por Face ID.
- Gestao de conta: nome no cadastro, alterar senha e excluir conta (apaga dados em cascata).
- Webhook Pluggy auto-cria contas quando o callback chega antes do retorno do app.
- Transacoes com filtros por conta/tipo (BANK/CREDIT), busca, paginacao por cursor,
  edicao de alias, categoria e override de assinatura (propaga para similares).
- Categorias com drill-down por periodo e categorizacao automatica por
  regras do usuario, MCC e keyword matching.
- Detecção de assinaturas recorrentes (mensal/anual) com projecao de gasto.
- Parcelamentos projetados no mes de cobranca (1a parcela na compra, demais no 1o dia dos meses seguintes): progresso, valor pago, restante e data estimada da ultima parcela, com badge da parcela (ex: 1/5) na lista de transacoes.
- Fatura do cartao no Dashboard com dois cards por cartao: a PAGAR (fechada) e
  ABERTA (ciclo em andamento). A pagar usa o valor oficial via Pluggy Bills
  quando publicado; senao calcula a vista + parcelas projetadas por conta propria
  (pra cobrir o atraso do MeuPluggy, que nao publica as parcelas do ciclo) ou cai
  no balance pra cartao sem parcelamento. A aberta inclui as parcelas comprometidas
  do ciclo. Dia de fechamento e vencimento configuraveis; snapshot do Pluggy
  (minimo, limite, bandeira) e sync em janela rolante.
- Atualizacao automatica entre telas via `DataRefreshContext` —
  conectou conta, sincronizou, editou transacao? Outras telas
  refazem fetch sozinhas, sem reiniciar app.
- Binance: conexao por API key, carteira (Spot + Funding), cotacoes e ordens com biometria.
- Investimentos automatizados: regras (ex: salario caiu -> investe) com aprovacao por tap e tarefas pendentes.
- Aba Ativos: carteira de investimentos das corretoras (Rico/XP via MeuPluggy) + Binance, agrupada por instituicao e classe (FII, acoes, renda fixa...), com valorizacao do dia/mes via snapshot diario e transacoes (aportes/resgates) por ativo.
- Corretora fica fora do saldo e das transacoes (dinheiro aplicado nao e saldo disponivel).
- Detecta o aporte real na corretora e fecha a regra de investimento sozinho.
- Aba Distribuicao: planejador de alocacao dividido por mes (seletor de mes por
  calendario, com transicao ao trocar), com varias distribuicoes (Salario,
  Freela...) reordenaveis por long-press, flag de recorrencia, itens em % ou R$,
  check de comprado/aplicado e vinculo de transacoes reais como comprovante (o
  valor do item vira a soma das vinculadas). A pill "salario" injeta sozinha as
  assinaturas e as parcelas do mes como itens automaticos e editaveis, com valor
  pela cobranca real do mes.
- Aba de Testes: dispara localmente as notificacoes do app (fatura fechou, vence
  amanha/hoje, resumo semanal) pra ver o visual sem esperar o dia certo.
- Resumo semanal (entradas, saidas, saldo e top categorias) com push toda segunda.
- Lembretes de fatura do cartao via push: quando a fatura fecha, na vespera e no
  dia do vencimento (dedup por cartao/ciclo).
- Notificacoes push via Expo (ordens executadas, resumo semanal).
- Loading com mascote (cachorro girando) em todo o app.
- Modo demonstracao com dados ficticios (sem rede nem biometria), com animacao de entrada (ripple a partir do toque) e alerta nativo de confirmacao ao sair.
- Tema claro/escuro com `ThemeProvider` e paletas dedicadas (fade sem flash).
- Barra de abas flutuante com pills em Liquid Glass (fallback blur), gradiente
  (conteudo faz fade por baixo ao scrollar), press suave e transicao direcional
  ao trocar de aba.
- Cache offline para dados principais.
- Expo SDK 54 (React 19 / RN 0.81 / Reanimated 4) com OTA via expo-updates:
  mudancas de JS vao por `eas update --branch preview` sem novo build; contador
  de versao OTA no rodape dos Ajustes. So mudanca nativa exige build.
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

Depois do build instalado, mudancas de JS vao por OTA (sem novo build):

```bash
cd frontend
npx eas update --branch preview --message "descricao"
```

Incremente `src/constants/otaVersion.ts` a cada update (o contador aparece no rodape dos Ajustes, provando que o bundle novo baixou). So mudanca nativa (novo modulo, splash, icone) exige `eas build`.

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
