# Changelog

Todas as mudancas notaveis deste projeto sao documentadas aqui.
O formato segue Keep a Changelog e o versionamento segue Semantic Versioning.

## [1.0.0] - 2026-05-12

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
