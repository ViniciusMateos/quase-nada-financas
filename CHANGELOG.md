# Changelog

Todas as mudancas notaveis deste projeto sao documentadas aqui.
O formato segue Keep a Changelog e o versionamento segue Semantic Versioning.

## [Unreleased]

## [1.3.0] - 2026-09-04

### Adicionado
- feat: movimentacao interna — auto-transferencia (PIX pra si mesmo, via campo selfName) e cofrinho/caixinha do Mercado Pago tratados como dinheiro que so muda de lugar, fora dos resumos (dashboard/analytics)
- feat: secoes colapsaveis na Distribuicao (assinaturas / parcelamentos / meus itens) com total e contagem, estado persistido
- feat: Settings avisa OTA desatualizada + botao "Atualizar agora" (com transicao suave antes do reload)

### Modificado
- update: splash clara no reload casa com o overlay "Atualizando" — sem o flash verde ao aplicar OTA (nativo, vale no build)

## [1.2.1] - 2026-05-31

### Changed

- Deteccao de banco do Pluggy expandida pra usar aliases conhecidos
  (Nubank/Nu Pagamentos, Itau, Bradesco, Inter, C6, PicPay, Mercado Pago,
  Banco do Brasil, Caixa, PagBank, BTG, XP, Safra, Santander). Agora
  `effectiveLogoUrl`, `effectivePrimaryColor`, `inlineLogoUrl` e o flag
  `isBrand` no Dashboard casam tanto pelo `customName` quanto pelo
  `bankName` original do connector. Inter tambem entrou no `PADDED_FILL`.

## [1.2.0] - 2026-05-29

### Added

- Parcelas do cartao projetadas no mes de cobranca: a 1a parcela fica na data
  da compra e as seguintes no primeiro dia dos meses seguintes. Parcelas
  futuras so aparecem quando a data chega, e a aba Parcelamentos usa o maior
  numero de parcela ja vencido pra calcular pago e restante (corrige o caso
  do Nubank que mostrava 3/12 em vez de 10/12).
- Badge da parcela (ex: 1/5) ao lado do nome na lista de transacoes.
- Animacao de entrada no modo demonstracao: circulo verde crescendo a partir
  do ponto do toque (ripple) com o mascote carregando.
- Alerta nativo de confirmacao ao sair da demonstracao, no tema do app.
- Animacao do seletor de cor do avatar nos ajustes, com os blocos abaixo
  deslizando junto.

### Fixed

- Login rapido por Face ID parava de funcionar (caia pra senha) quando uma
  falha de rede acontecia entre o refresh e o me(): o token rotacionado agora
  e persistido logo apos o refresh.
- Campo de edicao de transacao ficava escondido atras do teclado no bottom
  sheet.

### Manutencao

- Pendencias do expo doctor resolvidas (eas-cli removido, expo-font adicionado,
  versoes alinhadas ao SDK 52) e import dinamico liberado no tsc.

## [1.1.0] - 2026-05-25

### Added

- Modo demonstracao: entra com dados ficticios (bancos reais como Nubank,
  Itau e Inter, mas saldos, transacoes, parcelamentos e investimentos
  inventados), sem rede nem biometria. Acessivel pelas telas de login,
  registro e hub, e tambem pelas configuracoes. Ao sair, restaura a
  sessao real ou volta pro hub.

### Fixed

- Biometria (Face ID) nao disparava no primeiro cold start do app: o gate
  desbloqueava antes da sessao hidratar e so pedia autenticacao depois de
  fechar e reabrir. Agora espera o bootstrap antes de decidir o bloqueio.

## [1.0.0] - 2026-05-22

### Added

- Valorizacao real da carteira: cotacao B3 ao vivo (Yahoo) para FII,
  acoes e ETF, com variacao do dia e do mes por ativo e valorizacao
  total somando a cripto. O filtro por classe recalcula valor e
  valorizacao.
- Caixinha do Nubank (e posicoes de mesmo nome) agrupadas numa linha so,
  com os aportes ao tocar; posicoes zeradas sao escondidas.
- Parcelamentos e Assinaturas no estilo das transacoes: icone e nome da
  categoria, banco com logo e toque abre o editor da transacao.

### Changed

- Lucro dos ativos calculado contra o valor de mercado ao vivo, em vez do
  valor congelado da Pluggy.

### Fixed

- Variacao de 24h da Binance agora e real (antes ficava fixa em 0%).
- Banco com caixinha (ex: Nubank) nao some mais das Contas e transacoes:
  so e tratado como corretora quem tem investimento e nao tem cartao de
  credito; a caixinha aparece na aba Ativos.
- Lista de transacoes nao embaralha mais ao trocar de filtro (corrige a
  race da paginacao, de-dup por id e remonta a lista).

### Removed

- Overlay de logs de debug ("VER LOGS") do app.

## [0.5.0] - 2026-05-21

### Added

- Aba Ativos: carteira de investimentos das corretoras (Rico/XP via
  MeuPluggy) + Binance, agrupada por instituicao e classe (FII, acoes,
  renda fixa, ETF, Tesouro...), com filtro por classe e alocacao.
- Valorizacao do dia e do mes via snapshot diario da carteira
  (`PortfolioSnapshot`), ja que o Pluggy nao retorna lucro das posicoes.
- Transacoes (aportes/resgates) por ativo, abertas num sheet ao tocar.
- Endpoint `GET /portfolio` (agrupado + variacao) e
  `GET /portfolio/investments/:id/transactions`.
- Corretora (conta com investimentos) marcada como `isInvestment` e
  excluida do saldo, das transacoes e do filtro de contas.
- Deteccao automatica de aporte real na corretora: o worker bate o
  movimento BUY com a pendencia de lembrete e a marca como feita.
- Card da Binance e linha "Investido" na aba Contas; widget de
  investimentos no Inicio.

### Changed

- Loading padronizado: cachorro animado no topo (empurra o conteudo,
  estilo indicador nativo) e esqueleto quando nao ha dado ainda, no
  lugar do loader centralizado. Em Transacoes o esqueleto fica so na lista.
- Classificacao de ativos por nome/subtype (FII/FIAGRO por ticker `11`,
  Tesouro, ETF).

### Fixed

- Logo da XP cortada na aba Contas (passa a usar padding/contain).
- Tocar numa conta filtra as transacoes sempre (antes so na 1a vez).

## [0.4.0] - 2026-05-20

### Added

- Automacao de investimentos com Binance: ordens manuais (market buy)
  e regras (ex: salario caiu -> investe) com aprovacao por tap, carteira
  Spot + Funding em BRL, tarefas pendentes e card da Binance na aba Contas.
- Conexao de contas direto pelo MeuPluggy: resolve o conector
  dinamicamente em `/connectors` (fallback id 200) e abre o widget nele;
  leitura continua via Pluggy Data API.
- Resumo semanal de financas (`getWeeklySummary`): entradas, saidas,
  saldo e top categorias dos ultimos 7 dias, com tela dedicada e push
  toda segunda.
- Notificacoes push via Expo (ordens executadas, resumo semanal).
- Contas salvas, hub de selecao e login rapido por Face ID (refresh
  token no SecureStore), com app lock por Face ID.
- Alterar senha (`PATCH /auth/password`), excluir conta
  (`DELETE /auth/account`, cascata) e nome no cadastro.
- Gatilho `salary_received`: transacao de salario dispara as regras de
  investimento.

### Changed

- Identidade visual Quase Nada: `LoadingDog` (cachorro + anel girando) e
  `DogRefresh` substituem todos os spinners/skeletons e o pull-to-refresh;
  splash so com o cachorro.
- Config de build: plugin `expo-notifications`, `LSApplicationQueriesSchemes`
  pro deep link da Binance e `EXPO_PUBLIC_API_URL` de preview no servidor remoto.

### Fixed

- `BottomSheet` sobe junto com o teclado (listener de keyboardWillShow/Hide).
- Sincronizacao do refresh token da conta salva nas rotacoes do `apiClient`,
  evitando 403 de reuso no login rapido pelo hub.

## [0.3.0] - 2026-05-19

### Added

- Schema: `BankAccount.creditCloseDay` (1-31), configuravel manualmente
  pelo usuario para cartoes cujo conector Pluggy nao envia
  `balanceCloseDate` confiavel (ex: Mercado Pago).
- Endpoint `PATCH /accounts/bank-account/:id/credit-close-day`.
- `enrichWithCurrentStatement` calcula a fatura aberta em 3 camadas:
  `creditCloseDay` manual -> data do ultimo "Pagamento de fatura" ->
  `balance` cru da Pluggy.
- `DataRefreshContext` no app mobile: bump global que dispara refetch
  em todos os hooks de dados ao mesmo tempo. Acionado por
  ConnectBankScreen, ConnectBinanceScreen, EditTransactionSheet e
  mutators do `useAccounts`.
- Hook `useFocusRefresh` para refetch ao ganhar foco da tela (rede de
  seguranca complementar ao DataRefreshContext).
- UI no Dashboard: cada mini card de cartao mostra "Fecha dia X"
  editavel (lapis) e icone de info explicando "Fatura estimada".
- `AccountCard` da tela Contas exibe `currentStatementAmount` no
  sub-row do cartao (em vez do balance cru) e o mesmo icone de info.
- Agentes especializados do projeto em `.claude/agents/`:
  frontend-rn, backend-fastify, pluggy-integration,
  binance-integration, devops-deploy, qa-reviewer.

### Changed

- `BankBadge` unificado em squircle (cantos arredondados estilo iOS)
  para todos os bancos. Padding interno reservado a lista
  `PADDED_FILL` (hoje so Mercado Pago).
- `ThemeProvider` reescrito com 2 overlays empilhados (um por paleta)
  para eliminar o flash do fade na 1a e em todas as trocas seguintes.

### Fixed

- Migration `_add_is_subscription_override` que existia so no servidor
  foi sincronizada para o repo local.

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
